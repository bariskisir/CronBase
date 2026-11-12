import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cx } from "../../../utils/cx";
import "./Select.scss";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  size?: "sm" | "md";
  mono?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  placeholder = "Select…",
  size = "md",
  mono = false,
  disabled = false,
  className,
  ariaLabel,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handlePointer);
    return () => window.removeEventListener("mousedown", handlePointer);
  }, [open]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className={cx("select", `select--${size}`, mono && "select--mono", open && "select--open", className)}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className="select__trigger"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
      >
        <span className={cx("select__value", !selected && "select__value--placeholder")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={14} className="select__chevron" />
      </button>

      {open && (
        <ul id={listId} className="select__menu" role="listbox">
          {options.length === 0 && <li className="select__empty">No options</li>}
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  className={cx("select__option", isSelected && "select__option--selected")}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span className="select__option-label">{option.label}</span>
                  {isSelected && <Check size={14} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
