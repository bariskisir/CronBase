import type { ReactNode } from "react";
import { cx } from "../../../utils/cx";
import "./Panel.scss";

interface PanelProps {
  title?: ReactNode;
  actions?: ReactNode;
  tone?: "default" | "danger";
  className?: string;
  children?: ReactNode;
}

export function Panel({ title, actions, tone = "default", className, children }: PanelProps) {
  const hasHeader = Boolean(title || actions);
  return (
    <section className={cx("panel", `panel--${tone}`, className)}>
      {hasHeader && (
        <header className={cx("panel__header", !children && "panel__header--only")}>
          {title && <h3 className="panel__title">{title}</h3>}
          {actions && <div className="panel__actions">{actions}</div>}
        </header>
      )}
      {children && <div className="panel__body">{children}</div>}
    </section>
  );
}
