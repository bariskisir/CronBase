import type {
  LogLevel,
  PaginatedResponse,
  RunDetail,
  RunLogEntry,
  RunLogsPage,
  RunStatus,
  RunSummary,
  RunTrigger,
} from "../../../shared/types/api.js";
import { LOG_LEVELS } from "../../../shared/types/api.js";
import { getAppDatabase } from "../appDatabase.js";
import { asNullableNumber, asNullableString, asNumber, asString, type DbRow, nowIso } from "../rowMapping.js";

const MAX_RUNS_PER_PROJECT = 100;

const SUMMARY_SELECT = `
  SELECT r.*, (SELECT COUNT(*) FROM project_run_logs l WHERE l.run_id = r.id) AS log_count
  FROM project_runs r
`;

function toStatus(value: string): RunStatus {
  return value === "success" || value === "error" ? value : "running";
}

function toSummary(row: DbRow): RunSummary {
  return {
    id: asString(row.id),
    projectId: asString(row.project_id),
    version: asNumber(row.version),
    trigger: asString(row.trigger) === "schedule" ? "schedule" : "manual",
    status: toStatus(asString(row.status)),
    startedAt: asString(row.started_at),
    finishedAt: asNullableString(row.finished_at),
    durationMs: asNullableNumber(row.duration_ms),
    errorMessage: asNullableString(row.error_message),
    logCount: asNumber(row.log_count),
  };
}

function toLogEntry(row: DbRow): RunLogEntry {
  const level = asString(row.level) as LogLevel;
  return {
    id: asNumber(row.id),
    level: LOG_LEVELS.includes(level) ? level : "info",
    message: asString(row.message),
    createdAt: asString(row.created_at),
  };
}

export const runRepository = {
  create(input: { id: string; projectId: string; version: number; trigger: RunTrigger; startedAt: string }): void {
    getAppDatabase()
      .prepare(
        `INSERT INTO project_runs (id, project_id, version, trigger, status, started_at)
         VALUES (?, ?, ?, ?, 'running', ?)`,
      )
      .run(input.id, input.projectId, input.version, input.trigger, input.startedAt);
  },

  finish(
    id: string,
    projectId: string,
    status: Exclude<RunStatus, "running">,
    durationMs: number,
    errorMessage: string | null,
  ): void {
    const db = getAppDatabase();
    db.prepare(
      `UPDATE project_runs SET status = ?, finished_at = ?, duration_ms = ?, error_message = ?
       WHERE id = ?`,
    ).run(status, nowIso(), durationMs, errorMessage, id);

    db.prepare(
      `DELETE FROM project_runs
       WHERE project_id = ?
         AND status <> 'running'
         AND id NOT IN (
           SELECT id FROM project_runs
           WHERE project_id = ?
           ORDER BY started_at DESC
           LIMIT ?
         )`,
    ).run(projectId, projectId, MAX_RUNS_PER_PROJECT);
  },

  appendLog(runId: string, projectId: string, level: LogLevel, message: string, createdAt: string): void {
    getAppDatabase()
      .prepare(
        `INSERT INTO project_run_logs (run_id, project_id, level, message, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(runId, projectId, level, message, createdAt);
  },

  list(projectId: string, limit: number, offset: number): PaginatedResponse<RunSummary> {
    const db = getAppDatabase();
    const totalRow = db.prepare("SELECT COUNT(*) AS total FROM project_runs WHERE project_id = ?").get(projectId);
    const total = totalRow ? asNumber(totalRow.total) : 0;
    const rows = db
      .prepare(`${SUMMARY_SELECT} WHERE r.project_id = ? ORDER BY r.started_at DESC LIMIT ? OFFSET ?`)
      .all(projectId, limit, offset);
    return {
      items: rows.map(toSummary),
      total,
      limit,
      offset,
    };
  },

  find(runId: string, tailLimit = 200): RunDetail | null {
    const db = getAppDatabase();
    const row = db.prepare(`${SUMMARY_SELECT} WHERE r.id = ?`).get(runId);
    if (!row) return null;
    const logs =
      tailLimit > 0
        ? db
            .prepare("SELECT id, level, message, created_at FROM project_run_logs WHERE run_id = ? ORDER BY id DESC LIMIT ?")
            .all(runId, tailLimit)
            .reverse()
            .map(toLogEntry)
        : [];
    return { ...toSummary(row), logs };
  },

  listLogs(runId: string, limit: number, offset: number, level?: LogLevel): RunLogsPage | null {
    const db = getAppDatabase();
    const exists = db.prepare("SELECT 1 FROM project_runs WHERE id = ?").get(runId);
    if (!exists) return null;

    const totalAllRow = db.prepare("SELECT COUNT(*) AS total FROM project_run_logs WHERE run_id = ?").get(runId);
    const totalAll = totalAllRow ? asNumber(totalAllRow.total) : 0;

    if (level) {
      const totalRow = db
        .prepare("SELECT COUNT(*) AS total FROM project_run_logs WHERE run_id = ? AND level = ?")
        .get(runId, level);
      const total = totalRow ? asNumber(totalRow.total) : 0;
      const items = db
        .prepare(
          "SELECT id, level, message, created_at FROM project_run_logs WHERE run_id = ? AND level = ? ORDER BY id ASC LIMIT ? OFFSET ?",
        )
        .all(runId, level, limit, offset)
        .map(toLogEntry);
      return { items, total, totalAll, limit, offset };
    }

    const items = db
      .prepare("SELECT id, level, message, created_at FROM project_run_logs WHERE run_id = ? ORDER BY id ASC LIMIT ? OFFSET ?")
      .all(runId, limit, offset)
      .map(toLogEntry);
    return { items, total: totalAll, totalAll, limit, offset };
  },

  clear(projectId: string): void {
    const db = getAppDatabase();
    db.prepare(
      "DELETE FROM project_run_logs WHERE project_id = ? AND run_id IN (SELECT id FROM project_runs WHERE project_id = ? AND status <> 'running')",
    ).run(projectId, projectId);
    db.prepare("DELETE FROM project_runs WHERE project_id = ? AND status <> 'running'").run(projectId);
  },

  failInterruptedRuns(): number {
    const result = getAppDatabase()
      .prepare(
        `UPDATE project_runs SET status = 'error', finished_at = ?, error_message = 'Interrupted by server restart'
         WHERE status = 'running'`,
      )
      .run(nowIso());
    getAppDatabase().prepare("UPDATE projects SET last_run_status = 'error' WHERE last_run_status = 'running'").run();
    return Number(result.changes);
  },
};
