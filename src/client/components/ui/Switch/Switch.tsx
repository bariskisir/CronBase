import { cx } from "../../../utils/cx";
import "./Switch.scss";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export function Switch({ checked, onChange, label, disabled = false, ariaLabel }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? label}
      disabled={disabled}
      className={cx("switch", checked && "switch--on")}
      onClick={() => onChange(!checked)}
    >
      <span className="switch__track">
        <span className="switch__thumb" />
      </span>
      {label && <span className="switch__label">{label}</span>}
    </button>
  );
}
