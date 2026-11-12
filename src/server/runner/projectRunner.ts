import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { build, stop as stopEsbuild, type Plugin } from "esbuild";
import type { LogLevel, RunStatus, RunTrigger } from "../../shared/types/api.js";
import { moduleCacheDir, paths, projectDatabasePath, runTempDir } from "../config/paths.js";
import { envRepository } from "../db/repositories/envRepository.js";
import { projectRepository } from "../db/repositories/projectRepository.js";
import { runRepository } from "../db/repositories/runRepository.js";
import { versionRepository } from "../db/repositories/versionRepository.js";
import { nowIso } from "../db/rowMapping.js";
import { logger } from "../logger/appLogger.js";
import { createHttpModulePlugin } from "./httpModulePlugin.js";
import type { RunContext, WorkerInput, WorkerMessage } from "./workerProtocol.js";

const RUN_TIMEOUT_MS = Number(process.env.CRONBASE_RUN_TIMEOUT_SECONDS ?? 300) * 1000;
const WORKER_MAX_OLD_GEN_MB = Number(process.env.CRONBASE_WORKER_MAX_MEMORY_MB ?? 64);
const MAX_LOGS_PER_RUN = 1000;
const MAX_LOG_MESSAGE_LENGTH = 16 * 1024;
const MAX_COMPILE_CACHE_ENTRIES = 32;
const ESBUILD_IDLE_STOP_MS = 5000;

const LOG_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const isTypeScriptSource = import.meta.url.endsWith(".ts");
const workerUrl = new URL(`./workerRuntime.${isTypeScriptSource ? "ts" : "js"}`, import.meta.url);

const compiledCodeCache = new Map<string, string>();
let esbuildStopTimer: NodeJS.Timeout | null = null;

function scheduleEsbuildStop(): void {
  if (esbuildStopTimer) clearTimeout(esbuildStopTimer);
  esbuildStopTimer = setTimeout(() => {
    esbuildStopTimer = null;
    void stopEsbuild();
  }, ESBUILD_IDLE_STOP_MS);
  esbuildStopTimer.unref();
}

const cronbaseModulePlugin: Plugin = {
  name: "cronbase-runtime",
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^cronbase$/ }, () => ({ path: "cronbase", namespace: "cronbase-runtime" }));
    pluginBuild.onLoad({ filter: /.*/, namespace: "cronbase-runtime" }, () => ({
      loader: "js",
      contents: [
        "export const sqlite = globalThis.sqlite;",
        "export const db = globalThis.db;",
        "export const env = globalThis.env;",
      ].join("\n"),
    }));
  },
};

class CompileError extends Error {
  override name = "CompileError";
}

async function compile(cacheKey: string, code: string): Promise<string> {
  const cached = compiledCodeCache.get(cacheKey);
  if (cached !== undefined) {
    compiledCodeCache.delete(cacheKey);
    compiledCodeCache.set(cacheKey, cached);
    return cached;
  }

  try {
    const result = await build({
      stdin: { contents: code, loader: "ts", sourcefile: "main.ts", resolveDir: paths.root },
      bundle: true,
      write: false,
      format: "esm",
      platform: "node",
      target: "node22",
      packages: "external",
      sourcemap: false,
      logLevel: "silent",
      plugins: [cronbaseModulePlugin, createHttpModulePlugin(moduleCacheDir)],
    });
    const output = result.outputFiles[0];
    if (!output) throw new CompileError("Compilation produced no output.");

    if (compiledCodeCache.size >= MAX_COMPILE_CACHE_ENTRIES) {
      const oldestKey = compiledCodeCache.keys().next().value;
      if (oldestKey !== undefined) compiledCodeCache.delete(oldestKey);
    }
    compiledCodeCache.set(cacheKey, output.text);
    return output.text;
  } catch (error) {
    if (error instanceof CompileError) throw error;
    const errors = (error as { errors?: { text: string; location?: { line: number; column: number } | null }[] })
      .errors;
    if (errors && errors.length > 0) {
      const details = errors
        .map((item) =>
          item.location ? `main.ts:${item.location.line}:${item.location.column + 1} - ${item.text}` : item.text,
        )
        .join("\n");
      throw new CompileError(details);
    }
    throw new CompileError(error instanceof Error ? error.message : String(error));
  } finally {
    scheduleEsbuildStop();
  }
}

interface ActiveRun {
  runId: string;
  worker: Worker | null;
  cancelled: boolean;
}

class ProjectRunner {
  private readonly activeRuns = new Map<string, ActiveRun>();

  isRunning(projectId: string): boolean {
    return this.activeRuns.has(projectId);
  }

  start(projectId: string, trigger: RunTrigger): string {
    const project = projectRepository.findById(projectId);
    if (!project) throw new Error("Project not found");
    if (this.activeRuns.has(projectId)) throw new Error("Project is already running");

    const latest = versionRepository.latest(projectId);
    const runId = randomUUID();
    const startedAt = nowIso();
    const context: RunContext = {
      runId,
      projectId,
      projectName: project.name,
      version: latest?.version ?? 0,
      trigger,
      startedAt,
    };

    runRepository.create({ id: runId, projectId, version: context.version, trigger, startedAt });
    projectRepository.recordRunStart(projectId, startedAt, trigger === "schedule");
    this.activeRuns.set(projectId, { runId, worker: null, cancelled: false });
    logger.info("Run started", { projectId, projectName: project.name, runId, trigger, version: context.version });

    void this.execute(context, latest?.code ?? "", project.logLevel);
    return runId;
  }

  async cancel(projectId: string): Promise<void> {
    for (const key of compiledCodeCache.keys()) {
      if (key.startsWith(`${projectId}:`)) compiledCodeCache.delete(key);
    }
    const active = this.activeRuns.get(projectId);
    if (!active) return;
    active.cancelled = true;
    await active.worker?.terminate();
  }

  private async execute(context: RunContext, code: string, minLogLevel: LogLevel): Promise<void> {
    const startedMs = Date.now();
    const modulePath = path.join(runTempDir, `${context.runId}.mjs`);
    let logCount = 0;

    const appendLog = (level: LogLevel, message: string, timestamp: string = nowIso()): void => {
      if (LOG_PRIORITY[level] < LOG_PRIORITY[minLogLevel]) return;
      if (logCount >= MAX_LOGS_PER_RUN) return;
      logCount += 1;
      const text =
        logCount === MAX_LOGS_PER_RUN
          ? `Log limit of ${MAX_LOGS_PER_RUN} entries reached; further output is discarded.`
          : message.length > MAX_LOG_MESSAGE_LENGTH
            ? `${message.slice(0, MAX_LOG_MESSAGE_LENGTH)}… [truncated]`
            : message;
      try {
        runRepository.appendLog(context.runId, context.projectId, level, text, timestamp);
      } catch (error) {
        logger.error("Failed to persist run log", { runId: context.runId, error: String(error) });
      }
    };

    let status: Exclude<RunStatus, "running"> = "error";
    let errorMessage: string | null;

    try {
      const cacheKey = `${context.projectId}:${context.version}`;
      const compiled = await compile(cacheKey, code);
      await writeFile(modulePath, compiled, "utf8");
      const outcome = await this.spawnWorker(context, modulePath, appendLog);
      status = outcome.status;
      errorMessage = outcome.error;
    } catch (error) {
      errorMessage = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    } finally {
      await rm(modulePath, { force: true }).catch(() => undefined);
    }

    if (errorMessage) appendLog("error", errorMessage);

    const durationMs = Date.now() - startedMs;
    const cancelled = this.activeRuns.get(context.projectId)?.cancelled ?? false;
    this.activeRuns.delete(context.projectId);
    if (cancelled) return;

    try {
      runRepository.finish(context.runId, context.projectId, status, durationMs, errorMessage);
      projectRepository.recordRunResult(context.projectId, status);
    } catch (error) {
      logger.error("Failed to record run result", { runId: context.runId, error: String(error) });
    }

    const meta = { projectId: context.projectId, runId: context.runId, status, durationMs };
    if (status === "success") logger.info("Run finished", meta);
    else logger.warn("Run failed", { ...meta, error: errorMessage?.split("\n")[0] });
  }

  private spawnWorker(
    context: RunContext,
    modulePath: string,
    appendLog: (level: LogLevel, message: string, timestamp?: string) => void,
  ): Promise<{ status: Exclude<RunStatus, "running">; error: string | null }> {
    const env = envRepository.toRecord(context.projectId);
    const workerInput: WorkerInput = {
      modulePath,
      databasePath: projectDatabasePath(context.projectId),
      env,
      context,
    };

    return new Promise((resolve) => {
      const worker = new Worker(workerUrl, {
        workerData: workerInput,
        env,
        execArgv: isTypeScriptSource ? ["--import", "tsx"] : [],
        stdout: false,
        stderr: false,
        resourceLimits: {
          maxOldGenerationSizeMb: WORKER_MAX_OLD_GEN_MB,
          maxYoungGenerationSizeMb: 16,
          codeRangeSizeMb: 16,
          stackSizeMb: 4,
        },
      });

      const active = this.activeRuns.get(context.projectId);
      if (active) active.worker = worker;

      let settled = false;
      const settle = (status: Exclude<RunStatus, "running">, error: string | null): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        void worker.terminate();
        resolve({ status, error });
      };

      const timeout = setTimeout(() => {
        settle("error", `Execution timed out after ${Math.round(RUN_TIMEOUT_MS / 1000)} seconds.`);
      }, RUN_TIMEOUT_MS);

      worker.on("message", (message: WorkerMessage) => {
        if (message.type === "log") {
          appendLog(message.level, message.message, message.timestamp);
        } else if (message.status === "success") {
          settle("success", null);
        } else {
          settle("error", message.error);
        }
      });

      worker.on("error", (error: unknown) => {
        settle("error", error instanceof Error ? (error.stack ?? error.message) : String(error));
      });
      worker.on("exit", (code) => {
        const cancelled = this.activeRuns.get(context.projectId)?.cancelled ?? false;
        settle("error", cancelled ? "Run cancelled." : `Worker exited unexpectedly with code ${code}.`);
      });
    });
  }
}

export const projectRunner = new ProjectRunner();
