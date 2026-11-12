import { randomUUID } from "node:crypto";
import type { EnvVar, UpsertEnvVarRequest } from "../../../shared/types/api.js";
import { getAppDatabase } from "../appDatabase.js";
import { asString, type DbRow, nowIso } from "../rowMapping.js";

function toEnvVar(row: DbRow): EnvVar {
  return {
    id: asString(row.id),
    key: asString(row.key),
    value: asString(row.value),
    description: asString(row.description),
    updatedAt: asString(row.updated_at),
  };
}

export const envRepository = {
  list(projectId: string): EnvVar[] {
    return getAppDatabase()
      .prepare("SELECT * FROM project_env_vars WHERE project_id = ? ORDER BY key ASC")
      .all(projectId)
      .map(toEnvVar);
  },

  find(projectId: string, id: string): EnvVar | null {
    const row = getAppDatabase()
      .prepare("SELECT * FROM project_env_vars WHERE project_id = ? AND id = ?")
      .get(projectId, id);
    return row ? toEnvVar(row) : null;
  },

  findByKey(projectId: string, key: string): EnvVar | null {
    const row = getAppDatabase()
      .prepare("SELECT * FROM project_env_vars WHERE project_id = ? AND key = ?")
      .get(projectId, key);
    return row ? toEnvVar(row) : null;
  },

  toRecord(projectId: string): Record<string, string> {
    const record: Record<string, string> = {};
    for (const envVar of this.list(projectId)) {
      if (envVar.key === "__proto__" || envVar.key === "prototype" || envVar.key === "constructor") continue;
      record[envVar.key] = envVar.value;
    }
    return record;
  },

  create(projectId: string, input: UpsertEnvVarRequest): EnvVar {
    const id = randomUUID();
    getAppDatabase()
      .prepare(
        `INSERT INTO project_env_vars (id, project_id, key, value, description, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, projectId, input.key, input.value, input.description ?? "", nowIso());
    const created = this.find(projectId, id);
    if (!created) throw new Error("Failed to create environment variable");
    return created;
  },

  update(projectId: string, id: string, input: UpsertEnvVarRequest): EnvVar | null {
    getAppDatabase()
      .prepare(
        `UPDATE project_env_vars SET key = ?, value = ?, description = ?, updated_at = ?
         WHERE project_id = ? AND id = ?`,
      )
      .run(input.key, input.value, input.description ?? "", nowIso(), projectId, id);
    return this.find(projectId, id);
  },

  delete(projectId: string, id: string): boolean {
    const result = getAppDatabase()
      .prepare("DELETE FROM project_env_vars WHERE project_id = ? AND id = ?")
      .run(projectId, id);
    return Number(result.changes) > 0;
  },
};
