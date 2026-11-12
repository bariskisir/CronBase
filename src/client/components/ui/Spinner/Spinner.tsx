import { cx } from "../../../utils/cx";
import "./Spinner.scss";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  return <span className={cx("spinner", `spinner--${size}`, className)} role="status" aria-label="Loading" />;
}
