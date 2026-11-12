import type { SQLOutputValue } from "node:sqlite";

export type DbRow = Record<string, SQLOutputValue>;

export function nowIso(): string {
  return new Date().toISOString();
}

export function asString(value: SQLOutputValue | undefined): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

export function asNullableString(value: SQLOutputValue | undefined): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : String(value);
}

export function asNumber(value: SQLOutputValue | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  return 0;
}

export function asNullableNumber(value: SQLOutputValue | undefined): number | null {
  if (value === null || value === undefined) return null;
  return asNumber(value);
}
