import { mkdirSync } from "node:fs";
import path from "node:path";

const rootDir = path.resolve(process.env.CRONBASE_HOME ?? process.cwd());

export const paths = {
  root: rootDir,
  data: path.resolve(process.env.CRONBASE_DATA_DIR ?? path.join(rootDir, "data")),
  logs: path.resolve(process.env.CRONBASE_LOGS_DIR ?? path.join(rootDir, "logs")),
  temp: path.resolve(process.env.CRONBASE_TEMP_DIR ?? path.join(rootDir, "temp")),
  clientDist: path.join(rootDir, "dist", "client"),
} as const;

export const appDatabasePath = path.join(paths.data, "cronbase.sqlite");
export const projectDatabasesDir = path.join(paths.data, "projects");
export const runTempDir = path.join(paths.temp, "runs");
export const moduleCacheDir = path.join(paths.data, "cache", "modules");

export function projectDatabasePath(projectId: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) {
    throw new Error("Invalid project identifier");
  }
  const resolved = path.resolve(projectDatabasesDir, `${projectId}.sqlite`);
  if (!resolved.startsWith(`${projectDatabasesDir}${path.sep}`)) {
    throw new Error("Invalid project database path");
  }
  return resolved;
}

export function ensureDirectories(): void {
  for (const dir of [paths.data, projectDatabasesDir, paths.logs, paths.temp, runTempDir, moduleCacheDir]) {
    mkdirSync(dir, { recursive: true });
  }
}
