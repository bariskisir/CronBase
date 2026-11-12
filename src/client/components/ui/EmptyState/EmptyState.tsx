import type { ReactNode } from "react";
import { cx } from "../../../utils/cx";
import "./EmptyState.scss";

interface EmptyStateProps {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({ icon, title, description, action, compact = false, className }: EmptyStateProps) {
  return (
    <div className={cx("empty-state", compact && "empty-state--compact", className)}>
      {icon && <div className="empty-state__icon">{icon}</div>}
      {title && <p className="empty-state__title">{title}</p>}
      {description && <p className="empty-state__description">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
