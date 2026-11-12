import { existsSync, rmSync } from "node:fs";
import type { SQLOutputValue } from "node:sqlite";
import type {
  SqlValue,
  SqliteColumn,
  SqliteQueryResult,
  SqliteTableInfo,
  SqliteTableRows,
} from "../../shared/types/api.js";
import { projectDatabasePath } from "../config/paths.js";
import { asNumber, asString } from "./rowMapping.js";
import { executeStatement, openProjectDatabase, quoteIdentifier } from "./sqliteExecutor.js";

const MAX_QUERY_ROWS = 1000;

function toSqlValue(value: SQLOutputValue): SqlValue {
  if (value === null || typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "bigint") {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)
      ? Number(value)
      : value.toString();
  }
  return `<BLOB ${value.byteLength} bytes>`;
}

function normalizeRows(rows: Record<string, SQLOutputValue>[]): Record<string, SqlValue>[] {
  return rows.map((row) => {
    const normalized: Record<string, SqlValue> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key] = toSqlValue(value);
    }
    return normalized;
  });
}

function withDatabase<T>(projectId: string, callback: (db: ReturnType<typeof openProjectDatabase>) => T): T {
  const db = openProjectDatabase(projectDatabasePath(projectId));
  try {
    return callback(db);
  } finally {
    db.close();
  }
}

export const projectDatabase = {
  initialize(projectId: string): void {
    withDatabase(projectId, () => undefined);
  },

  remove(projectId: string): void {
    const basePath = projectDatabasePath(projectId);
    for (const suffix of ["", "-wal", "-shm"]) {
      const filePath = `${basePath}${suffix}`;
      if (existsSync(filePath)) rmSync(filePath, { force: true });
    }
  },

  listTables(projectId: string): SqliteTableInfo[] {
    return withDatabase(projectId, (db) => {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .all()
        .map((row) => asString(row.name));

      return tables.map((name): SqliteTableInfo => {
        const quoted = quoteIdentifier(name);
        const columns = db
          .prepare(`PRAGMA table_info(${quoted})`)
          .all()
          .map((row): SqliteColumn => ({
            name: asString(row.name),
            type: asString(row.type),
            notNull: asNumber(row.notnull) === 1,
            primaryKey: asNumber(row.pk) > 0,
          }));
        const countRow = db.prepare(`SELECT COUNT(*) AS total FROM ${quoted}`).get();
        return { name, columns, rowCount: countRow ? asNumber(countRow.total) : 0 };
      });
    });
  },

  tableExists(projectId: string, table: string): boolean {
    return withDatabase(projectId, (db) => {
      const row = db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
      return row !== undefined;
    });
  },

  readTable(projectId: string, table: string, limit: number, offset: number): SqliteTableRows {
    return withDatabase(projectId, (db) => {
      const quoted = quoteIdentifier(table);
      const statement = db.prepare(`SELECT * FROM ${quoted} LIMIT ? OFFSET ?`);
      const columns = statement.columns().map((column) => column.name);
      const rows = statement.all(limit, offset) as Record<string, SQLOutputValue>[];
      const countRow = db.prepare(`SELECT COUNT(*) AS total FROM ${quoted}`).get();
      return {
        table,
        columns,
        rows: normalizeRows(rows),
        total: countRow ? asNumber(countRow.total) : 0,
        limit,
        offset,
      };
    });
  },

  runQuery(projectId: string, sql: string): SqliteQueryResult {
    return withDatabase(projectId, (db) => {
      const startedAt = performance.now();
      const result = executeStatement(db, sql);
      const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;

      if (result.kind === "rows") {
        return {
          kind: "rows",
          columns: result.columns,
          rows: normalizeRows(result.rows.slice(0, MAX_QUERY_ROWS)),
          truncated: result.rows.length > MAX_QUERY_ROWS,
          durationMs,
        };
      }
      return { ...result, durationMs };
    });
  },
};
