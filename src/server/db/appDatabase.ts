import { DatabaseSync } from "node:sqlite";
import { appDatabasePath } from "../config/paths.js";

const SCHEMA_VERSION = 3;

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS app_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    token_hash  TEXT PRIMARY KEY,
    created_at  TEXT NOT NULL,
    expires_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    enabled             INTEGER NOT NULL DEFAULT 0,
    log_level           TEXT NOT NULL DEFAULT 'info',
    schedule_type       TEXT NOT NULL CHECK (schedule_type IN ('none', 'cron', 'interval')),
    cron_expr           TEXT,
    interval_value      INTEGER,
    interval_unit       TEXT,
    schedule_anchor_at  TEXT NOT NULL,
    last_run_at         TEXT,
    last_run_status     TEXT,
    last_scheduled_at   TEXT,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS project_versions (
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version     INTEGER NOT NULL,
    code        TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    PRIMARY KEY (project_id, version)
  );

  CREATE TABLE IF NOT EXISTS project_env_vars (
    id           TEXT PRIMARY KEY,
    project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    key          TEXT NOT NULL,
    value        TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    updated_at   TEXT NOT NULL,
    UNIQUE (project_id, key)
  );

  CREATE TABLE IF NOT EXISTS project_runs (
    id             TEXT PRIMARY KEY,
    project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version        INTEGER NOT NULL,
    trigger        TEXT NOT NULL CHECK (trigger IN ('manual', 'schedule')),
    status         TEXT NOT NULL CHECK (status IN ('running', 'success', 'error')),
    started_at     TEXT NOT NULL,
    finished_at    TEXT,
    duration_ms    INTEGER,
    error_message  TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_project_runs_project_started
    ON project_runs (project_id, started_at DESC);

  CREATE TABLE IF NOT EXISTS project_run_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id      TEXT NOT NULL REFERENCES project_runs(id) ON DELETE CASCADE,
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    level       TEXT NOT NULL,
    message     TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_project_run_logs_run ON project_run_logs (run_id, id);
`;

let database: DatabaseSync | null = null;

export function getAppDatabase(): DatabaseSync {
  if (database) {
    return database;
  }

  const db = new DatabaseSync(appDatabasePath);
  db.exec("PRAGMA auto_vacuum = FULL;");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA cache_size = -512;");
  db.exec("PRAGMA temp_store = FILE;");
  db.exec("PRAGMA mmap_size = 0;");
  db.exec("PRAGMA journal_size_limit = 1048576;");
  const autoVacuumRow = db.prepare("PRAGMA auto_vacuum").get() as { auto_vacuum?: number } | undefined;
  if (autoVacuumRow?.auto_vacuum !== 1) {
    db.exec("PRAGMA auto_vacuum = FULL; VACUUM;");
  }
  db.exec(SCHEMA_SQL);
  migrateSchema(db);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION};`);

  database = db;
  return db;
}

function migrateSchema(db: DatabaseSync): void {
  const columns = db.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
  const hasLogLevel = columns.some((c) => c.name === "log_level");
  const tableSqlRow = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'projects'").get() as
    { sql?: string } | undefined;
  const supportsNoneSchedule = Boolean(tableSqlRow?.sql?.includes("'none'"));

  if (hasLogLevel && supportsNoneSchedule) {
    return;
  }

  db.exec("PRAGMA foreign_keys = OFF;");
  db.exec("BEGIN;");
  try {
    if (!hasLogLevel) {
      db.exec("ALTER TABLE projects ADD COLUMN log_level TEXT NOT NULL DEFAULT 'info';");
    }
    db.exec(`
      CREATE TABLE projects_new (
        id                  TEXT PRIMARY KEY,
        name                TEXT NOT NULL,
        enabled             INTEGER NOT NULL DEFAULT 0,
        log_level           TEXT NOT NULL DEFAULT 'info',
        schedule_type       TEXT NOT NULL CHECK (schedule_type IN ('none', 'cron', 'interval')),
        cron_expr           TEXT,
        interval_value      INTEGER,
        interval_unit       TEXT,
        schedule_anchor_at  TEXT NOT NULL,
        last_run_at         TEXT,
        last_run_status     TEXT,
        last_scheduled_at   TEXT,
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL
      );
      INSERT INTO projects_new (
        id, name, enabled, log_level, schedule_type, cron_expr,
        interval_value, interval_unit, schedule_anchor_at,
        last_run_at, last_run_status, last_scheduled_at,
        created_at, updated_at
      )
      SELECT
        id, name, enabled, log_level,
        CASE WHEN enabled = 0 THEN 'none' ELSE schedule_type END,
        CASE WHEN enabled = 0 THEN NULL ELSE cron_expr END,
        CASE WHEN enabled = 0 THEN NULL ELSE interval_value END,
        CASE WHEN enabled = 0 THEN NULL ELSE interval_unit END,
        schedule_anchor_at,
        last_run_at, last_run_status, last_scheduled_at,
        created_at, updated_at
      FROM projects;
      DROP TABLE projects;
      ALTER TABLE projects_new RENAME TO projects;
    `);
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys = ON;");
  }
}

export function closeAppDatabase(): void {
  database?.close();
  database = null;
}

export function transaction<T>(callback: () => T): T {
  const db = getAppDatabase();
  db.exec("BEGIN");
  try {
    const result = callback();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
