import type { DatabaseSync, SQLInputValue, SQLOutputValue } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { format, inspect } from "node:util";
import { parentPort, workerData } from "node:worker_threads";
import type { LogLevel } from "../../shared/types/api.js";
import { executeStatement, openProjectDatabase, type SqlParams } from "../db/sqliteExecutor.js";
import type { WorkerInput, WorkerMessage } from "./workerProtocol.js";

type UserValue = SQLInputValue | boolean | undefined | Date;
type UserParams = readonly UserValue[] | Readonly<Record<string, UserValue>>;
type Row = Record<string, SQLOutputValue>;

interface SqliteResultSet {
  columns: string[];
  rows: Row[];
  rowsAffected: number;
  lastInsertRowid: number | null;
}

type SqlQuery = string | { sql: string; args?: UserParams };

const input = workerData as WorkerInput;
const port = parentPort;

function post(message: WorkerMessage): void {
  port?.postMessage(message);
}

function formatArgs(args: unknown[]): string {
  return args.map((arg) => (typeof arg === "string" ? arg : inspect(arg, { depth: 6, breakLength: 120 }))).join(" ");
}

function emitLog(level: LogLevel, args: unknown[]): void {
  post({ type: "log", level, message: formatArgs(args), timestamp: new Date().toISOString() });
}

console.log = (...args: unknown[]) => emitLog("info", args);
console.info = (...args: unknown[]) => emitLog("info", args);
console.warn = (...args: unknown[]) => emitLog("warn", args);
console.error = (...args: unknown[]) => emitLog("error", args);
console.debug = (...args: unknown[]) => emitLog("debug", args);
console.trace = (...args: unknown[]) => emitLog("debug", [format(...args), new Error().stack ?? ""]);
console.table = (data: unknown) => emitLog("info", [data]);

let connection: DatabaseSync | null = null;

function database(): DatabaseSync {
  connection ??= openProjectDatabase(input.databasePath);
  return connection;
}

function toSqlValue(value: UserValue): SQLInputValue {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function normalizeParams(params: UserParams | undefined): SqlParams {
  if (!params) return [];
  if (Array.isArray(params)) return (params as readonly UserValue[]).map(toSqlValue);
  const named: Record<string, SQLInputValue> = {};
  for (const [key, value] of Object.entries(params as Record<string, UserValue>)) {
    named[key] = toSqlValue(value);
  }
  return named;
}

function runQuery(query: SqlQuery, args?: UserParams): SqliteResultSet {
  const sql = typeof query === "string" ? query : query.sql;
  const params = normalizeParams(typeof query === "string" ? args : (query.args ?? args));
  const result = executeStatement(database(), sql, params);
  return result.kind === "rows"
    ? { columns: result.columns, rows: result.rows, rowsAffected: 0, lastInsertRowid: null }
    : { columns: [], rows: [], rowsAffected: result.changes, lastInsertRowid: result.lastInsertRowid };
}

const sqlite = {
  async execute(query: SqlQuery, args?: UserParams): Promise<SqliteResultSet> {
    return runQuery(query, args);
  },

  async batch(queries: readonly SqlQuery[]): Promise<SqliteResultSet[]> {
    const db = database();
    db.exec("BEGIN");
    try {
      const results = queries.map((query) => runQuery(query));
      db.exec("COMMIT");
      return results;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  },
};

const db = {
  exec(sql: string): void {
    database().exec(sql);
  },

  run(sql: string, ...params: UserValue[]): { changes: number; lastInsertRowid: number | null } {
    const result = runQuery(sql, params);
    return { changes: result.rowsAffected, lastInsertRowid: result.lastInsertRowid };
  },

  query<T extends object = Row>(sql: string, ...params: UserValue[]): T[] {
    return runQuery(sql, params).rows as T[];
  },

  get<T extends object = Row>(sql: string, ...params: UserValue[]): T | undefined {
    return runQuery(sql, params).rows[0] as T | undefined;
  },
};

const envValues: Readonly<Record<string, string>> = Object.freeze({ ...input.env });

const env = new Proxy(
  {
    get: (key: string): string | undefined => envValues[key],
    has: (key: string): boolean => Object.hasOwn(envValues, key),
    toObject: (): Record<string, string> => ({ ...envValues }),
  },
  {
    get(target, property, receiver) {
      if (typeof property === "string" && Object.hasOwn(envValues, property)) {
        return envValues[property];
      }
      return Reflect.get(target, property, receiver);
    },
    set() {
      throw new Error("Environment variables are read-only. Manage them from the Environment Variables tab.");
    },
  },
);

for (const key of Object.keys(process.env)) delete process.env[key];
Object.assign(process.env, envValues);

const runtimeGlobals = {
  sqlite,
  db,
  env,
  Deno: { env: { get: (key: string) => envValues[key], toObject: () => ({ ...envValues }) } },
};

Object.assign(globalThis, runtimeGlobals);

process.on("unhandledRejection", (reason) => {
  emitLog("error", ["Unhandled promise rejection:", reason]);
});

function describeError(error: unknown): string {
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`;
  return typeof error === "string" ? error : inspect(error);
}

async function main(): Promise<void> {
  try {
    const module = (await import(pathToFileURL(input.modulePath).href)) as { default?: unknown };
    if (typeof module.default === "function") {
      await (module.default as (context: WorkerInput["context"]) => unknown)(input.context);
    }
    post({ type: "result", status: "success" });
  } catch (error) {
    post({ type: "result", status: "error", error: describeError(error) });
  } finally {
    connection?.close();
    connection = null;
  }
}

void main();
