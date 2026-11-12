import type { ReactNode } from "react";
import { cx } from "../../../utils/cx";
import "./SegmentedControl.scss";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  disabled?: boolean;
  fullWidth?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  disabled = false,
  fullWidth = false,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cx("segmented", `segmented--${size}`, fullWidth && "segmented--full", className)}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            className={cx("segmented__item", active && "segmented__item--active")}
            onClick={() => onChange(option.value)}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
