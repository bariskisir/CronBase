import type { InputHTMLAttributes, ReactNode } from "react";
import { cx } from "../../../utils/cx";
import "./TextInput.scss";

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  inputSize?: "sm" | "md" | "lg";
  mono?: boolean;
  leadingIcon?: ReactNode;
  trailing?: ReactNode;
  invalid?: boolean;
  wrapperClassName?: string;
}

export function TextInput({
  inputSize = "md",
  mono = false,
  leadingIcon,
  trailing,
  invalid = false,
  className,
  wrapperClassName,
  type = "text",
  ...rest
}: TextInputProps) {
  return (
    <div
      className={cx(
        "text-input",
        `text-input--${inputSize}`,
        mono && "text-input--mono",
        invalid && "text-input--invalid",
        rest.disabled && "text-input--disabled",
        wrapperClassName,
      )}
    >
      {leadingIcon && <span className="text-input__icon">{leadingIcon}</span>}
      <input
        type={type}
        className={cx("text-input__control", className)}
        aria-invalid={invalid || undefined}
        {...rest}
      />
      {trailing && <span className="text-input__trailing">{trailing}</span>}
    </div>
  );
}
