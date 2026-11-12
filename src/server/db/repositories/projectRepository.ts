import type { IntervalUnit, LogLevel, RunStatus, Schedule } from "../../../shared/types/api.js";
import { INTERVAL_UNITS, LOG_LEVELS } from "../../../shared/types/api.js";
import { getAppDatabase } from "../appDatabase.js";
import { asNullableNumber, asNullableString, asNumber, asString, type DbRow, nowIso } from "../rowMapping.js";

export interface ProjectRecord {
  id: string;
  name: string;
  enabled: boolean;
  logLevel: LogLevel;
  schedule: Schedule;
  scheduleAnchorAt: string;
  lastRunAt: string | null;
  lastRunStatus: RunStatus | null;
  lastScheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toSchedule(row: DbRow): Schedule {
  const type = asString(row.schedule_type);
  if (type === "none" || asNumber(row.enabled) === 0) {
    return { type: "none" };
  }
  if (type === "cron") {
    return { type: "cron", cron: asString(row.cron_expr) };
  }
  const unit = asString(row.interval_unit) as IntervalUnit;
  return {
    type: "interval",
    intervalValue: asNullableNumber(row.interval_value) ?? 1,
    intervalUnit: INTERVAL_UNITS.includes(unit) ? unit : "hours",
  };
}

function toProject(row: DbRow): ProjectRecord {
  const status = asNullableString(row.last_run_status);
  const logLevel = asString(row.log_level) as LogLevel;
  const schedule = toSchedule(row);
  return {
    id: asString(row.id),
    name: asString(row.name),
    enabled: schedule.type !== "none",
    logLevel: LOG_LEVELS.includes(logLevel) ? logLevel : "info",
    schedule,
    scheduleAnchorAt: asString(row.schedule_anchor_at),
    lastRunAt: asNullableString(row.last_run_at),
    lastRunStatus: status === "running" || status === "success" || status === "error" ? status : null,
    lastScheduledAt: asNullableString(row.last_scheduled_at),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

function scheduleColumns(schedule: Schedule): [number, string, string | null, number | null, string | null] {
  if (schedule.type === "none") return [0, "none", null, null, null];
  if (schedule.type === "cron") return [1, "cron", schedule.cron, null, null];
  return [1, "interval", null, schedule.intervalValue, schedule.intervalUnit];
}

export const projectRepository = {
  list(): ProjectRecord[] {
    return getAppDatabase().prepare("SELECT * FROM projects ORDER BY created_at ASC").all().map(toProject);
  },

  count(): number {
    const row = getAppDatabase().prepare("SELECT COUNT(*) AS total FROM projects").get();
    return row ? asNumber(row.total) : 0;
  },

  findById(id: string): ProjectRecord | null {
    const row = getAppDatabase().prepare("SELECT * FROM projects WHERE id = ?").get(id);
    return row ? toProject(row) : null;
  },

  create(input: { id: string; name: string; logLevel?: LogLevel; schedule: Schedule }): ProjectRecord {
    const timestamp = nowIso();
    const [enabled, type, cron, intervalValue, intervalUnit] = scheduleColumns(input.schedule);
    getAppDatabase()
      .prepare(
        `INSERT INTO projects
           (id, name, enabled, log_level, schedule_type, cron_expr, interval_value, interval_unit,
            schedule_anchor_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.name,
        enabled,
        input.logLevel ?? "info",
        type,
        cron,
        intervalValue,
        intervalUnit,
        timestamp,
        timestamp,
        timestamp,
      );
    const created = this.findById(input.id);
    if (!created) throw new Error("Failed to create project");
    return created;
  },

  rename(id: string, name: string): void {
    getAppDatabase().prepare("UPDATE projects SET name = ?, updated_at = ? WHERE id = ?").run(name, nowIso(), id);
  },

  setLogLevel(id: string, logLevel: LogLevel): void {
    getAppDatabase()
      .prepare("UPDATE projects SET log_level = ?, updated_at = ? WHERE id = ?")
      .run(logLevel, nowIso(), id);
  },

  updateSchedule(id: string, schedule: Schedule): void {
    const timestamp = nowIso();
    const [enabled, type, cron, intervalValue, intervalUnit] = scheduleColumns(schedule);
    getAppDatabase()
      .prepare(
        `UPDATE projects
         SET enabled = ?, schedule_type = ?, cron_expr = ?, interval_value = ?, interval_unit = ?,
             schedule_anchor_at = ?, last_scheduled_at = NULL, updated_at = ?
         WHERE id = ?`,
      )
      .run(enabled, type, cron, intervalValue, intervalUnit, timestamp, timestamp, id);
  },

  touch(id: string): void {
    getAppDatabase().prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(nowIso(), id);
  },

  recordRunStart(id: string, startedAt: string, scheduled: boolean): void {
    const sql = scheduled
      ? "UPDATE projects SET last_run_at = ?, last_run_status = 'running', last_scheduled_at = ? WHERE id = ?"
      : "UPDATE projects SET last_run_at = ?, last_run_status = 'running' WHERE id = ?";
    const statement = getAppDatabase().prepare(sql);
    if (scheduled) statement.run(startedAt, startedAt, id);
    else statement.run(startedAt, id);
  },

  recordRunResult(id: string, status: RunStatus): void {
    getAppDatabase().prepare("UPDATE projects SET last_run_status = ? WHERE id = ?").run(status, id);
  },

  markScheduled(id: string, at: string): void {
    getAppDatabase().prepare("UPDATE projects SET last_scheduled_at = ? WHERE id = ?").run(at, id);
  },

  delete(id: string): void {
    getAppDatabase().prepare("DELETE FROM projects WHERE id = ?").run(id);
  },
};
