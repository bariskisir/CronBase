import type { AppSettings, LogLevel, Theme } from "../../../shared/types/api.js";
import { LOG_LEVELS } from "../../../shared/types/api.js";
import { getAppDatabase } from "../appDatabase.js";
import { asString, nowIso } from "../rowMapping.js";

export type SettingKey =
  "password_hash" | "must_change_password" | "secret_key" | "theme" | "log_level" | "mask_credentials";

const DEFAULT_THEME: Theme = "dark";
const DEFAULT_LOG_LEVEL: LogLevel = "info";

export const settingsRepository = {
  get(key: SettingKey): string | null {
    const row = getAppDatabase().prepare("SELECT value FROM app_settings WHERE key = ?").get(key);
    return row ? asString(row.value) : null;
  },

  set(key: SettingKey, value: string): void {
    getAppDatabase()
      .prepare(
        `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(key, value, nowIso());
  },

  getAppSettings(): AppSettings {
    const theme = this.get("theme");
    const logLevel = this.get("log_level");
    const maskCredentials = this.get("mask_credentials");
    return {
      theme: theme === "light" || theme === "dark" ? theme : DEFAULT_THEME,
      logLevel: LOG_LEVELS.includes(logLevel as LogLevel) ? (logLevel as LogLevel) : DEFAULT_LOG_LEVEL,
      maskCredentials: maskCredentials === "true",
    };
  },

  ensureDefaults(): void {
    if (this.get("theme") === null) this.set("theme", DEFAULT_THEME);
    if (this.get("log_level") === null) this.set("log_level", DEFAULT_LOG_LEVEL);
    if (this.get("mask_credentials") === null) this.set("mask_credentials", "false");
  },
};
