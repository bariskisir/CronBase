import type { ReactNode } from "react";
import { cx } from "../../../utils/cx";
import "./Field.scss";

interface FieldProps {
  label: ReactNode;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, className, children }: FieldProps) {
  return (
    <div className={cx("field", className)}>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}
