import { randomUUID } from "node:crypto";
import type { LogLevel, ProjectDetail, ProjectSummary, Schedule } from "../../shared/types/api.js";
import { transaction } from "../db/appDatabase.js";
import { projectDatabase } from "../db/projectDatabase.js";
import { envRepository } from "../db/repositories/envRepository.js";
import { type ProjectRecord, projectRepository } from "../db/repositories/projectRepository.js";
import { versionRepository } from "../db/repositories/versionRepository.js";
import { logger } from "../logger/appLogger.js";
import { projectRunner } from "../runner/projectRunner.js";
import { computeNextRun, describeSchedule } from "../scheduler/scheduleParser.js";
import { scheduler } from "../scheduler/schedulerEngine.js";
import { DEFAULT_PROJECT_CODE } from "./projectTemplates.js";

export const DEFAULT_SCHEDULE: Schedule = { type: "none" };

function toSummary(project: ProjectRecord): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    enabled: project.enabled,
    logLevel: project.logLevel,
    scheduleType: project.schedule.type,
    scheduleDescription: describeSchedule(project.schedule),
    lastRunAt: project.lastRunAt,
    lastRunStatus: project.lastRunStatus,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

function nextRunFor(project: ProjectRecord): string | null {
  if (!project.enabled || project.schedule.type === "none") return null;
  const next =
    scheduler.getNextRun(project.id) ??
    computeNextRun(project.schedule, { anchorAt: project.scheduleAnchorAt, lastScheduledAt: project.lastScheduledAt });
  return next?.toISOString() ?? null;
}

export const projectService = {
  list(): ProjectSummary[] {
    return projectRepository.list().map(toSummary);
  },

  find(projectId: string): ProjectRecord | null {
    return projectRepository.findById(projectId);
  },

  getDetail(projectId: string): ProjectDetail | null {
    const project = projectRepository.findById(projectId);
    if (!project) return null;
    const latest = versionRepository.latest(projectId);
    return {
      ...toSummary(project),
      code: latest?.code ?? "",
      currentVersion: latest?.version ?? 0,
      schedule: {
        schedule: project.schedule,
        description: describeSchedule(project.schedule),
        nextRunAt: nextRunFor(project),
      },
      isRunning: projectRunner.isRunning(projectId),
    };
  },

  create(input: {
    name: string;
    code?: string;
    logLevel?: LogLevel;
    schedule?: Schedule;
    env?: readonly { key: string; value: string; description: string }[];
  }): ProjectRecord {
    const id = randomUUID();
    const project = transaction(() => {
      const created = projectRepository.create({
        id,
        name: input.name,
        logLevel: input.logLevel ?? "info",
        schedule: input.schedule ?? DEFAULT_SCHEDULE,
      });
      versionRepository.saveIfChanged(id, input.code ?? DEFAULT_PROJECT_CODE);
      for (const envVar of input.env ?? []) {
        envRepository.create(id, envVar);
      }
      return created;
    });
    projectDatabase.initialize(id);
    scheduler.refresh(id);
    logger.info("Project created", { projectId: id, name: input.name });
    return project;
  },

  rename(projectId: string, name: string): void {
    projectRepository.rename(projectId, name);
    logger.info("Project renamed", { projectId, name });
  },

  setLogLevel(projectId: string, logLevel: LogLevel): void {
    projectRepository.setLogLevel(projectId, logLevel);
    logger.info("Project log level updated", { projectId, logLevel });
  },

  updateSchedule(projectId: string, schedule: Schedule): void {
    projectRepository.updateSchedule(projectId, schedule);
    scheduler.refresh(projectId);
    logger.info("Project schedule updated", { projectId, schedule: describeSchedule(schedule) });
  },

  saveCode(projectId: string, code: string): { version: number; created: boolean } {
    const result = versionRepository.saveIfChanged(projectId, code);
    if (result.created) {
      projectRepository.touch(projectId);
      logger.info("Project code saved", { projectId, version: result.version });
    }
    return result;
  },

  async delete(projectId: string): Promise<void> {
    scheduler.remove(projectId);
    await projectRunner.cancel(projectId);
    projectRepository.delete(projectId);
    projectDatabase.remove(projectId);
    logger.info("Project deleted", { projectId });
  },
};
