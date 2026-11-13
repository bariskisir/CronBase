export type Theme = "dark" | "light";

export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const INTERVAL_UNITS = ["seconds", "minutes", "hours", "days", "weeks", "years"] as const;
export type IntervalUnit = (typeof INTERVAL_UNITS)[number];

export type ScheduleType = "none" | "cron" | "interval";

export type RunTrigger = "manual" | "schedule";
export type RunStatus = "running" | "success" | "error";

export interface NoneSchedule {
  type: "none";
}

export interface CronSchedule {
  type: "cron";
  cron: string;
}

export interface IntervalSchedule {
  type: "interval";
  intervalValue: number;
  intervalUnit: IntervalUnit;
}

export type Schedule = NoneSchedule | CronSchedule | IntervalSchedule;

export interface ScheduleInfo {
  schedule: Schedule;
  description: string;
  nextRunAt: string | null;
}

export interface SchedulePreview {
  valid: boolean;
  description: string | null;
  nextRunAt: string | null;
  error: string | null;
}

export interface LoginRequest {
  password: string;
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  mustChangePassword: boolean;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken?: string;
}

export interface SessionResponse {
  authenticated: boolean;
  mustChangePassword: boolean;
}

export interface ChangePasswordRequest {
  currentPassword?: string;
  newPassword: string;
}

export interface AppSettings {
  theme: Theme;
  logLevel: LogLevel;
  maskCredentials: boolean;
}

export type UpdateAppSettingsRequest = Partial<AppSettings>;

export interface SecretKeyResponse {
  secretKey: string;
}

export interface UpdateSecretKeyRequest {
  secretKey: string;
}

export interface UpdateSecretKeyResponse {
  secretKey: string;
  tokens: AuthTokensResponse;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface AppLogFilesResponse {
  files: string[];
}

export interface AppLogContentResponse {
  date: string;
  lines: string[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  enabled: boolean;
  logLevel: LogLevel;
  scheduleDescription: string;
  scheduleType: ScheduleType;
  lastRunAt: string | null;
  lastRunStatus: RunStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail extends ProjectSummary {
  code: string;
  currentVersion: number;
  schedule: ScheduleInfo;
  isRunning: boolean;
}

export interface CreateProjectRequest {
  name: string;
}

export interface UpdateProjectRequest {
  name?: string;
  logLevel?: LogLevel;
}

export interface SaveCodeRequest {
  code: string;
}

export interface SaveCodeResponse {
  version: number;
  created: boolean;
}

export interface ProjectVersionSummary {
  version: number;
  createdAt: string;
  size: number;
}

export interface ProjectVersionDetail extends ProjectVersionSummary {
  code: string;
}

export interface EnvVar {
  id: string;
  key: string;
  value: string;
  description: string;
  updatedAt: string;
}

export interface UpsertEnvVarRequest {
  key: string;
  value: string;
  description?: string;
}

export interface RunSummary {
  id: string;
  projectId: string;
  version: number;
  trigger: RunTrigger;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  logCount: number;
}

export interface RunLogEntry {
  id: number;
  level: LogLevel;
  message: string;
  createdAt: string;
}

export interface RunLogsPage extends PaginatedResponse<RunLogEntry> {
  totalAll: number;
}

export interface RunDetail extends RunSummary {
  logs: RunLogEntry[];
}

export interface StartRunResponse {
  runId: string;
}

export type SqlValue = string | number | null;

export interface SqliteColumn {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
}

export interface SqliteTableInfo {
  name: string;
  rowCount: number;
  columns: SqliteColumn[];
}

export interface SqliteTableRows {
  table: string;
  columns: string[];
  rows: Record<string, SqlValue>[];
  total: number;
  limit: number;
  offset: number;
}

export interface SqliteQueryRequest {
  sql: string;
}

export type SqliteQueryResult =
  | {
      kind: "rows";
      columns: string[];
      rows: Record<string, SqlValue>[];
      truncated: boolean;
      durationMs: number;
    }
  | {
      kind: "changes";
      changes: number;
      lastInsertRowid: number | null;
      durationMs: number;
    };

export interface ApiErrorResponse {
  error: string;
}
