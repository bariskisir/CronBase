import { projectRepository } from "../db/repositories/projectRepository.js";
import { nowIso } from "../db/rowMapping.js";
import { logger } from "../logger/appLogger.js";
import { projectRunner } from "../runner/projectRunner.js";
import { computeNextRun } from "./scheduleParser.js";

const MAX_TIMER_DELAY_MS = 2_147_483_647;

interface ScheduledJob {
  timer: NodeJS.Timeout;
  nextRunAt: Date;
}

class SchedulerEngine {
  private readonly jobs = new Map<string, ScheduledJob>();
  private running = false;

  start(): void {
    this.running = true;
    for (const project of projectRepository.list()) {
      this.refresh(project.id);
    }
    logger.info("Scheduler started", { scheduledProjects: this.jobs.size });
  }

  stop(): void {
    this.running = false;
    for (const job of this.jobs.values()) clearTimeout(job.timer);
    this.jobs.clear();
  }

  refresh(projectId: string): void {
    this.clear(projectId);
    if (!this.running) return;

    const project = projectRepository.findById(projectId);
    if (!project || !project.enabled) return;

    const nextRunAt = computeNextRun(project.schedule, {
      anchorAt: project.scheduleAnchorAt,
      lastScheduledAt: project.lastScheduledAt,
    });
    if (!nextRunAt) {
      logger.warn("Project schedule has no upcoming run", { projectId });
      return;
    }

    this.arm(projectId, nextRunAt);
    logger.debug("Project scheduled", { projectId, nextRunAt: nextRunAt.toISOString() });
  }

  remove(projectId: string): void {
    this.clear(projectId);
  }

  getNextRun(projectId: string): Date | null {
    return this.jobs.get(projectId)?.nextRunAt ?? null;
  }

  private clear(projectId: string): void {
    const job = this.jobs.get(projectId);
    if (job) clearTimeout(job.timer);
    this.jobs.delete(projectId);
  }

  private arm(projectId: string, nextRunAt: Date): void {
    const delay = Math.max(0, nextRunAt.getTime() - Date.now());
    const timer = setTimeout(
      () => {
        if (Date.now() < nextRunAt.getTime()) {
          this.arm(projectId, nextRunAt);
          return;
        }
        this.fire(projectId);
      },
      Math.min(delay, MAX_TIMER_DELAY_MS),
    );
    this.jobs.set(projectId, { timer, nextRunAt });
  }

  private fire(projectId: string): void {
    this.jobs.delete(projectId);
    const project = projectRepository.findById(projectId);
    if (!project || !project.enabled) return;

    if (projectRunner.isRunning(projectId)) {
      logger.warn("Skipping scheduled run because the previous run is still in progress", { projectId });
      projectRepository.markScheduled(projectId, nowIso());
    } else {
      try {
        projectRunner.start(projectId, "schedule");
      } catch (error) {
        logger.error("Failed to start scheduled run", { projectId, error: String(error) });
        projectRepository.markScheduled(projectId, nowIso());
      }
    }

    this.refresh(projectId);
  }
}

export const scheduler = new SchedulerEngine();
