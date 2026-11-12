import { Cron } from "croner";
import cronstrue from "cronstrue";
import type { IntervalUnit, Schedule, SchedulePreview } from "../../shared/types/api.js";

const UNIT_MS: Record<Exclude<IntervalUnit, "years">, number> = {
  seconds: 1_000,
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
  weeks: 604_800_000,
};

const UNIT_LABELS: Record<IntervalUnit, [singular: string, plural: string]> = {
  seconds: ["second", "seconds"],
  minutes: ["minute", "minutes"],
  hours: ["hour", "hours"],
  days: ["day", "days"],
  weeks: ["week", "weeks"],
  years: ["year", "years"],
};

export function addInterval(date: Date, value: number, unit: IntervalUnit): Date {
  if (unit === "years") {
    const next = new Date(date.getTime());
    next.setFullYear(next.getFullYear() + value);
    return next;
  }
  return new Date(date.getTime() + value * UNIT_MS[unit]);
}

export function assertValidSchedule(schedule: Schedule): void {
  if (schedule.type === "none") return;
  if (schedule.type === "cron") {
    const parts = schedule.cron.trim().split(/\s+/);
    if (parts.length < 5 || parts.length > 6) {
      throw new Error("Cron expression must have 5 fields (or 6 with seconds).");
    }
    const job = new Cron(schedule.cron.trim(), { paused: true });
    if (!job.nextRun()) {
      throw new Error("Cron expression never matches a future date.");
    }
    return;
  }
  if (!Number.isInteger(schedule.intervalValue) || schedule.intervalValue < 1) {
    throw new Error("Interval value must be a positive whole number.");
  }
}

export function describeSchedule(schedule: Schedule): string {
  if (schedule.type === "none") return "No schedule";
  if (schedule.type === "interval") {
    const [singular, plural] = UNIT_LABELS[schedule.intervalUnit];
    return schedule.intervalValue === 1 ? `Every ${singular}` : `Every ${schedule.intervalValue} ${plural}`;
  }
  try {
    return cronstrue.toString(schedule.cron.trim(), { use24HourTimeFormat: true });
  } catch {
    return schedule.cron;
  }
}

export function nextCronRun(expression: string, from: Date): Date | null {
  try {
    return new Cron(expression.trim(), { paused: true }).nextRun(from);
  } catch {
    return null;
  }
}

export function computeNextRun(
  schedule: Schedule,
  context: { anchorAt: string; lastScheduledAt: string | null },
  now: Date = new Date(),
): Date | null {
  if (schedule.type === "none") return null;
  if (schedule.type === "cron") {
    return nextCronRun(schedule.cron, now);
  }
  const base = new Date(context.lastScheduledAt ?? context.anchorAt);
  const next = addInterval(base, schedule.intervalValue, schedule.intervalUnit);
  return next.getTime() < now.getTime() ? now : next;
}

export function previewSchedule(schedule: Schedule): SchedulePreview {
  try {
    assertValidSchedule(schedule);
    const now = new Date();
    const next = computeNextRun(schedule, { anchorAt: now.toISOString(), lastScheduledAt: null }, now);
    return {
      valid: true,
      description: describeSchedule(schedule),
      nextRunAt: next?.toISOString() ?? null,
      error: null,
    };
  } catch (error) {
    return {
      valid: false,
      description: null,
      nextRunAt: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
