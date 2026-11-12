import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../../../utils/cx";
import "./IconButton.scss";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  icon: ReactNode;
  size?: "xs" | "sm" | "md";
  tone?: "default" | "danger";
  active?: boolean;
}

export function IconButton({
  label,
  icon,
  size = "md",
  tone = "default",
  active = false,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx("icon-btn", `icon-btn--${size}`, `icon-btn--${tone}`, active && "icon-btn--active", className)}
      {...rest}
    >
      {icon}
    </button>
  );
}
