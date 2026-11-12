import type { DotStatus } from "../ui";
import { StatusDot } from "../ui";
import { cx } from "../../utils/cx";
import "./ProjectAvatar.scss";

interface ProjectAvatarProps {
  name: string;
  status?: DotStatus;
  size?: "sm" | "md";
  className?: string;
}

export function ProjectAvatar({ name, status, size = "md", className }: ProjectAvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className={cx("project-avatar", `project-avatar--${size}`, className)} aria-hidden="true">
      {initial}
      {status && <StatusDot status={status} className="project-avatar__status" />}
    </span>
  );
}
