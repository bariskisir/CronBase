import type { PaginatedResponse, ProjectVersionDetail, ProjectVersionSummary } from "../../../shared/types/api.js";
import { getAppDatabase } from "../appDatabase.js";
import { asNumber, asString, type DbRow, nowIso } from "../rowMapping.js";

function toSummary(row: DbRow): ProjectVersionSummary {
  return {
    version: asNumber(row.version),
    createdAt: asString(row.created_at),
    size: asNumber(row.size),
  };
}

export const versionRepository = {
  list(projectId: string, limit: number, offset: number): PaginatedResponse<ProjectVersionSummary> {
    const db = getAppDatabase();
    const totalRow = db.prepare("SELECT COUNT(*) AS total FROM project_versions WHERE project_id = ?").get(projectId);
    const total = totalRow ? asNumber(totalRow.total) : 0;
    const items = db
      .prepare(
        `SELECT version, created_at, LENGTH(code) AS size
         FROM project_versions WHERE project_id = ? ORDER BY version DESC LIMIT ? OFFSET ?`,
      )
      .all(projectId, limit, offset)
      .map(toSummary);
    return { items, total, limit, offset };
  },

  find(projectId: string, version: number): ProjectVersionDetail | null {
    const row = getAppDatabase()
      .prepare(
        `SELECT version, created_at, LENGTH(code) AS size, code
         FROM project_versions WHERE project_id = ? AND version = ?`,
      )
      .get(projectId, version);
    return row ? { ...toSummary(row), code: asString(row.code) } : null;
  },

  latest(projectId: string): ProjectVersionDetail | null {
    const row = getAppDatabase()
      .prepare(
        `SELECT version, created_at, LENGTH(code) AS size, code
         FROM project_versions WHERE project_id = ? ORDER BY version DESC LIMIT 1`,
      )
      .get(projectId);
    return row ? { ...toSummary(row), code: asString(row.code) } : null;
  },

  saveIfChanged(projectId: string, code: string): { version: number; created: boolean } {
    const latest = this.latest(projectId);
    if (latest && latest.code === code) {
      return { version: latest.version, created: false };
    }
    const version = (latest?.version ?? 0) + 1;
    getAppDatabase()
      .prepare("INSERT INTO project_versions (project_id, version, code, created_at) VALUES (?, ?, ?, ?)")
      .run(projectId, version, code, nowIso());
    return { version, created: true };
  },

  count(projectId: string): number {
    const row = getAppDatabase()
      .prepare("SELECT COUNT(*) AS total FROM project_versions WHERE project_id = ?")
      .get(projectId);
    return row ? asNumber(row.total) : 0;
  },

  delete(projectId: string, version: number): boolean {
    const result = getAppDatabase()
      .prepare("DELETE FROM project_versions WHERE project_id = ? AND version = ?")
      .run(projectId, version);
    return Number(result.changes) > 0;
  },
};
