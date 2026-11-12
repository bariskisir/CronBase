import type { LogLevel, RunTrigger } from "../../shared/types/api.js";

export interface RunContext {
  runId: string;
  projectId: string;
  projectName: string;
  version: number;
  trigger: RunTrigger;
  startedAt: string;
}

export interface WorkerInput {
  modulePath: string;
  databasePath: string;
  env: Record<string, string>;
  context: RunContext;
}

export type WorkerMessage =
  | { type: "log"; level: LogLevel; message: string; timestamp: string }
  | { type: "result"; status: "success" }
  | { type: "result"; status: "error"; error: string };
