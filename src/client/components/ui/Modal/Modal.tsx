import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cx } from "../../../utils/cx";
import { IconButton } from "../IconButton/IconButton";
import "./Modal.scss";

export type ModalSize = "sm" | "md" | "lg" | "xl";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  icon?: ReactNode;
  size?: ModalSize;
  footer?: ReactNode;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  icon,
  size = "md",
  footer,
  flush = false,
  className,
  children,
}: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className={cx("modal", `modal--${size}`, className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div className="modal__heading">
            {icon && <span className="modal__icon">{icon}</span>}
            <h2 id={titleId} className="modal__title">
              {title}
            </h2>
          </div>
          <IconButton label="Close" size="sm" icon={<X size={16} />} onClick={onClose} />
        </header>

        <div className={cx("modal__body", flush && "modal__body--flush")}>{children}</div>

        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
