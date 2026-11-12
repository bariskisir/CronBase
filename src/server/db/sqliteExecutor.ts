import { DatabaseSync, type SQLInputValue, type SQLOutputValue } from "node:sqlite";

export function openProjectDatabase(filePath: string): DatabaseSync {
  const db = new DatabaseSync(filePath);
  db.exec("PRAGMA auto_vacuum = FULL;");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA cache_size = -512;");
  db.exec("PRAGMA temp_store = FILE;");
  db.exec("PRAGMA mmap_size = 0;");
  db.exec("PRAGMA journal_size_limit = 1048576;");
  const autoVacuumRow = db.prepare("PRAGMA auto_vacuum").get() as { auto_vacuum?: number } | undefined;
  if (autoVacuumRow?.auto_vacuum !== 1) {
    db.exec("PRAGMA auto_vacuum = FULL; VACUUM;");
  }
  return db;
}

export type SqlParams = readonly SQLInputValue[] | Readonly<Record<string, SQLInputValue>>;

export type StatementResult =
  | { kind: "rows"; columns: string[]; rows: Record<string, SQLOutputValue>[] }
  | { kind: "changes"; changes: number; lastInsertRowid: number | null };

export function executeStatement(db: DatabaseSync, sql: string, params: SqlParams = []): StatementResult {
  const statement = db.prepare(sql);
  const columns = statement.columns().map((column) => column.name);
  const args: SQLInputValue[] = [];
  const named: Record<string, SQLInputValue> | null = Array.isArray(params)
    ? null
    : (params as Record<string, SQLInputValue>);
  if (Array.isArray(params)) args.push(...params);

  if (columns.length > 0) {
    const rows = (named ? statement.all(named) : statement.all(...args)) as Record<string, SQLOutputValue>[];
    return { kind: "rows", columns, rows };
  }

  const result = named ? statement.run(named) : statement.run(...args);
  const lastInsertRowid = Number(result.lastInsertRowid);
  return {
    kind: "changes",
    changes: Number(result.changes),
    lastInsertRowid: Number.isFinite(lastInsertRowid) && lastInsertRowid > 0 ? lastInsertRowid : null,
  };
}

export function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
