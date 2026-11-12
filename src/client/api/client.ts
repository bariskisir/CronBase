import type {
  AppLogContentResponse,
  AppLogFilesResponse,
  AppSettings,
  AuthTokensResponse,
  ChangePasswordRequest,
  EnvVar,
  ProjectDetail,
  ProjectSummary,
  ProjectVersionDetail,
  ProjectVersionSummary,
  RunDetail,
  RunSummary,
  SaveCodeResponse,
  Schedule,
  SchedulePreview,
  SecretKeyResponse,
  SessionResponse,
  SqliteQueryResult,
  SqliteTableInfo,
  SqliteTableRows,
  StartRunResponse,
  UpdateAppSettingsRequest,
  UpdateProjectRequest,
  UpdateSecretKeyResponse,
  UpsertEnvVarRequest,
} from "../../shared/types/api";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const ACCESS_TOKEN_KEY = "cronbase.accessToken";
const REFRESH_TOKEN_KEY = "cronbase.refreshToken";

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
let unauthorizedHandler: (() => void) | null = null;

try {
  accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
} catch {
  accessToken = null;
  refreshToken = null;
}

export function setAuthTokens(tokens: AuthTokensResponse): void {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  } catch {
    return;
  }
}

export function clearAuthTokens(): void {
  accessToken = null;
  refreshToken = null;
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    return;
  }
}

export function hasStoredTokens(): boolean {
  return Boolean(accessToken || refreshToken);
}

export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler;
}

async function tryRefreshTokens(): Promise<boolean> {
  if (!refreshToken) return false;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        clearAuthTokens();
        return false;
      }
      const tokens = (await response.json()) as AuthTokensResponse;
      setAuthTokens(tokens);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(method: HttpMethod, path: string, body?: unknown, allowRefresh = true): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (
    response.status === 401 &&
    allowRefresh &&
    path !== "/auth/login" &&
    path !== "/auth/refresh" &&
    path !== "/auth/logout"
  ) {
    const refreshed = await tryRefreshTokens();
    if (refreshed) {
      return request<T>(method, path, body, false);
    }
    clearAuthTokens();
    unauthorizedHandler?.();
  }

  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Request failed (${response.status})`;
    throw new ApiError(response.status, message);
  }
  return payload as T;
}

const enc = encodeURIComponent;

export const api = {
  auth: {
    session: async (): Promise<SessionResponse> => {
      if (!accessToken && refreshToken) {
        const refreshed = await tryRefreshTokens();
        if (!refreshed) return { authenticated: false, mustChangePassword: false };
      }
      const res = await request<SessionResponse>("GET", "/auth/session");
      if (!res.authenticated && refreshToken) {
        const refreshed = await tryRefreshTokens();
        if (refreshed) {
          return request<SessionResponse>("GET", "/auth/session");
        }
      }
      return res;
    },
    login: async (password: string): Promise<AuthTokensResponse> => {
      const tokens = await request<AuthTokensResponse>("POST", "/auth/login", { password }, false);
      setAuthTokens(tokens);
      return tokens;
    },
    logout: async (): Promise<void> => {
      const currentRefresh = refreshToken ?? undefined;
      clearAuthTokens();
      await request<SessionResponse>("POST", "/auth/logout", { refreshToken: currentRefresh }, false).catch(
        () => undefined,
      );
    },
    changePassword: async (body: ChangePasswordRequest): Promise<AuthTokensResponse> => {
      const tokens = await request<AuthTokensResponse>("POST", "/auth/change-password", body);
      setAuthTokens(tokens);
      return tokens;
    },
  },

  settings: {
    get: () => request<AppSettings>("GET", "/settings"),
    update: (body: UpdateAppSettingsRequest) => request<AppSettings>("PUT", "/settings", body),
    getSecretKey: () => request<SecretKeyResponse>("GET", "/settings/secret-key"),
    updateSecretKey: async (secretKey: string): Promise<string> => {
      const res = await request<UpdateSecretKeyResponse>("PUT", "/settings/secret-key", { secretKey });
      setAuthTokens(res.tokens);
      return res.secretKey;
    },
    regenerateSecretKey: async (): Promise<string> => {
      const res = await request<UpdateSecretKeyResponse>("POST", "/settings/secret-key/regenerate");
      setAuthTokens(res.tokens);
      return res.secretKey;
    },
    listAppLogs: () => request<AppLogFilesResponse>("GET", "/settings/app-logs"),
    readAppLog: (date: string) => request<AppLogContentResponse>("GET", `/settings/app-logs/${enc(date)}`),
  },

  projects: {
    list: () => request<ProjectSummary[]>("GET", "/projects"),
    get: (id: string) => request<ProjectDetail>("GET", `/projects/${enc(id)}`),
    create: (name: string) => request<ProjectDetail>("POST", "/projects", { name }),
    update: (id: string, body: UpdateProjectRequest) => request<ProjectDetail>("PATCH", `/projects/${enc(id)}`, body),
    remove: (id: string) => request<void>("DELETE", `/projects/${enc(id)}`),
    updateSchedule: (id: string, schedule: Schedule) =>
      request<ProjectDetail>("PUT", `/projects/${enc(id)}/schedule`, schedule),
    previewSchedule: (schedule: Schedule) => request<SchedulePreview>("POST", "/projects/schedule-preview", schedule),
    saveCode: (id: string, code: string) => request<SaveCodeResponse>("PUT", `/projects/${enc(id)}/code`, { code }),
    listVersions: (id: string) => request<ProjectVersionSummary[]>("GET", `/projects/${enc(id)}/versions`),
    getVersion: (id: string, version: number) =>
      request<ProjectVersionDetail>("GET", `/projects/${enc(id)}/versions/${version}`),
    restoreVersion: (id: string, version: number) =>
      request<SaveCodeResponse>("POST", `/projects/${enc(id)}/versions/${version}/restore`),
    deleteVersion: (id: string, version: number) =>
      request<ProjectDetail>("DELETE", `/projects/${enc(id)}/versions/${version}`),
  },

  env: {
    list: (projectId: string) => request<EnvVar[]>("GET", `/projects/${enc(projectId)}/env`),
    create: (projectId: string, body: UpsertEnvVarRequest) =>
      request<EnvVar>("POST", `/projects/${enc(projectId)}/env`, body),
    update: (projectId: string, envId: string, body: UpsertEnvVarRequest) =>
      request<EnvVar>("PUT", `/projects/${enc(projectId)}/env/${enc(envId)}`, body),
    remove: (projectId: string, envId: string) =>
      request<void>("DELETE", `/projects/${enc(projectId)}/env/${enc(envId)}`),
  },

  runs: {
    list: (projectId: string, options: { limit?: number; before?: string } = {}) => {
      const query = new URLSearchParams();
      if (options.limit) query.set("limit", String(options.limit));
      if (options.before) query.set("before", options.before);
      const suffix = query.size > 0 ? `?${query.toString()}` : "";
      return request<RunSummary[]>("GET", `/projects/${enc(projectId)}/runs${suffix}`);
    },
    start: (projectId: string) => request<StartRunResponse>("POST", `/projects/${enc(projectId)}/runs`),
    clear: (projectId: string) => request<void>("DELETE", `/projects/${enc(projectId)}/runs`),
    get: (runId: string) => request<RunDetail>("GET", `/runs/${enc(runId)}`),
  },

  sqlite: {
    tables: (projectId: string) => request<SqliteTableInfo[]>("GET", `/projects/${enc(projectId)}/sqlite/tables`),
    rows: (projectId: string, table: string, limit: number, offset: number) =>
      request<SqliteTableRows>(
        "GET",
        `/projects/${enc(projectId)}/sqlite/tables/${enc(table)}?limit=${limit}&offset=${offset}`,
      ),
    query: (projectId: string, sql: string) =>
      request<SqliteQueryResult>("POST", `/projects/${enc(projectId)}/sqlite/query`, { sql }),
  },
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
