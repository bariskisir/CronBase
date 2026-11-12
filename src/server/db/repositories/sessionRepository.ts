import { getAppDatabase } from "../appDatabase.js";
import { nowIso } from "../rowMapping.js";

export const sessionRepository = {
  create(tokenHash: string, expiresAt: Date): void {
    getAppDatabase()
      .prepare("INSERT INTO refresh_tokens (token_hash, created_at, expires_at) VALUES (?, ?, ?)")
      .run(tokenHash, nowIso(), expiresAt.toISOString());
  },

  isValid(tokenHash: string): boolean {
    const row = getAppDatabase()
      .prepare("SELECT 1 AS ok FROM refresh_tokens WHERE token_hash = ? AND expires_at > ?")
      .get(tokenHash, nowIso());
    return row !== undefined;
  },

  consume(tokenHash: string): boolean {
    const result = getAppDatabase()
      .prepare("DELETE FROM refresh_tokens WHERE token_hash = ? AND expires_at > ?")
      .run(tokenHash, nowIso());
    return Number(result.changes) > 0;
  },

  delete(tokenHash: string): void {
    getAppDatabase().prepare("DELETE FROM refresh_tokens WHERE token_hash = ?").run(tokenHash);
  },

  deleteAll(): void {
    getAppDatabase().prepare("DELETE FROM refresh_tokens").run();
  },

  deleteExpired(): void {
    getAppDatabase().prepare("DELETE FROM refresh_tokens WHERE expires_at <= ?").run(nowIso());
  },
};
