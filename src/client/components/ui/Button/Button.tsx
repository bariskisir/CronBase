import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../../../utils/cx";
import { Spinner } from "../Spinner/Spinner";
import "./Button.scss";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
  block?: boolean;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  trailingIcon,
  loading = false,
  block = false,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx("btn", `btn--${variant}`, `btn--${size}`, block && "btn--block", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : icon}
      {children !== undefined && children !== null && children !== false && (
        <span className="btn__label">{children}</span>
      )}
      {trailingIcon}
    </button>
  );
}
