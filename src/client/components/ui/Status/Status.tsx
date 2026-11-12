import type { RunStatus } from "../../../../shared/types/api";
import { cx } from "../../../utils/cx";
import "./Status.scss";

export type DotStatus = RunStatus | "idle" | "paused";

interface StatusDotProps {
  status: DotStatus;
  className?: string;
  title?: string;
}

export function StatusDot({ status, className, title }: StatusDotProps) {
  return <span className={cx("status-dot", `status-dot--${status}`, className)} title={title} aria-hidden={!title} />;
}

const STATUS_LABELS: Record<RunStatus, string> = {
  running: "Running",
  success: "Success",
  error: "Failed",
};

interface StatusPillProps {
  status: RunStatus;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  return (
    <span className={cx("status-pill", `status-pill--${status}`, className)}>
      <span className="status-pill__dot" />
      {STATUS_LABELS[status]}
    </span>
  );
}
