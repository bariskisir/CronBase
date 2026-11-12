import { cx } from "../../../utils/cx";
import "./BrandMark.scss";

interface BrandMarkProps {
  size?: number;
  className?: string;
}

export function BrandMark({ size = 28, className }: BrandMarkProps) {
  return (
    <svg
      className={cx("brand-mark", className)}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="8" className="brand-mark__bg" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#fff" strokeWidth="2.5" />
      <path
        d="M16 11v5l3.5 2.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
