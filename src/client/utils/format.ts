import { Cron } from "croner";
import type { IntervalUnit, Schedule } from "../../shared/types/api";

const INTERVAL_UNIT_MS: Record<IntervalUnit, number> = {
  seconds: 1_000,
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
  weeks: 7 * 86_400_000,
  years: 365 * 86_400_000,
};

export function computeClientNextRunMs(
  schedule: Schedule,
  initialNextRunIso: string | null | undefined,
  nowMs: number = Date.now(),
): number | null {
  if (schedule.type === "none") return null;

  const baseMs = initialNextRunIso ? Date.parse(initialNextRunIso) : Number.NaN;

  if (schedule.type === "interval") {
    const unitMs = INTERVAL_UNIT_MS[schedule.intervalUnit] ?? 60_000;
    const stepMs = Math.max(1_000, Math.floor(schedule.intervalValue || 1) * unitMs);
    if (Number.isNaN(baseMs)) return nowMs + stepMs;
    if (baseMs > nowMs) return baseMs;
    const elapsed = nowMs - baseMs;
    const steps = Math.floor(elapsed / stepMs) + 1;
    return baseMs + steps * stepMs;
  }

  if (!Number.isNaN(baseMs) && baseMs > nowMs) {
    return baseMs;
  }

  try {
    const job = new Cron(schedule.cron.trim());
    const next = job.nextRun(new Date(nowMs));
    return next ? next.getTime() : null;
  } catch {
    return null;
  }
}

export function formatCountdown(targetMs: number, nowMs: number = Date.now()): string {
  const totalSeconds = Math.max(1, Math.ceil((targetMs - nowMs) / 1000));

  if (totalSeconds < 60) {
    return `in ${totalSeconds}s`;
  }

  if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `in ${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }

  if (totalSeconds < 86_400) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `in ${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }

  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `in ${days}d ${hours}h ${minutes}m`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatTimeOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return iso;
  const diffSeconds = Math.round((target - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 5) return diffSeconds >= 0 ? "in a few seconds" : "just now";
  if (absSeconds < 60) return diffSeconds >= 0 ? `in ${absSeconds}s` : `${absSeconds}s ago`;

  const minutes = Math.round(absSeconds / 60);
  if (minutes < 60) return diffSeconds >= 0 ? `in ${minutes}m` : `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return diffSeconds >= 0 ? `in ${hours}h` : `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return diffSeconds >= 0 ? `in ${days}d` : `${days}d ago`;

  return formatDateTime(iso);
}

export function formatDuration(durationMs: number | null | undefined): string {
  if (durationMs === null || durationMs === undefined) return "—";
  if (durationMs < 1000) return `${durationMs} ms`;
  const seconds = durationMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(2)} s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remSeconds}s`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
