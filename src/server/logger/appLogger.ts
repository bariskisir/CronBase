import { appendFileSync } from "node:fs";
import path from "node:path";
import { format } from "node:util";
import type { LogLevel } from "../../shared/types/api.js";
import { paths } from "../config/paths.js";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

type LogMeta = Record<string, unknown>;

class AppLogger {
  private level: LogLevel = "info";

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  debug(message: string, meta?: LogMeta): void {
    this.write("debug", message, meta);
  }

  info(message: string, meta?: LogMeta): void {
    this.write("info", message, meta);
  }

  warn(message: string, meta?: LogMeta): void {
    this.write("warn", message, meta);
  }

  error(message: string, meta?: LogMeta): void {
    this.write("error", message, meta);
  }

  private write(level: LogLevel, message: string, meta?: LogMeta): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.level]) {
      return;
    }

    const now = new Date();
    const metaText = meta && Object.keys(meta).length > 0 ? ` ${format("%j", meta)}` : "";
    const line = `[${now.toISOString()}] [${level.toUpperCase()}] ${message}${metaText}`;

    const consoleMethod = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    consoleMethod(line);

    try {
      appendFileSync(this.filePathFor(now), `${line}\n`, "utf8");
    } catch (error) {
      console.error(`[logger] Failed to write log file: ${String(error)}`);
    }
  }

  private filePathFor(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return path.join(paths.logs, `app-${year}-${month}-${day}.log`);
  }
}

export const logger = new AppLogger();
