import type { ReactNode } from "react";
import { cx } from "../../../utils/cx";
import "./Badge.scss";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

interface BadgeProps {
  tone?: BadgeTone;
  mono?: boolean;
  className?: string;
  title?: string;
  children: ReactNode;
}

export function Badge({ tone = "neutral", mono = false, className, title, children }: BadgeProps) {
  return (
    <span className={cx("badge", `badge--${tone}`, mono && "badge--mono", className)} title={title}>
      {children}
    </span>
  );
}
