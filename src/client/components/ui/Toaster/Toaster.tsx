import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import "./Toaster.scss";

export type ToastKind = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const ICONS: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

interface ToasterProps {
  toasts: readonly ToastItem[];
  onDismiss: (id: number) => void;
}

export function Toaster({ toasts, onDismiss }: ToasterProps) {
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind];
        return (
          <div key={toast.id} className={`toast toast--${toast.kind}`}>
            <Icon size={16} className="toast__icon" />
            <span className="toast__message">{toast.message}</span>
            <button type="button" className="toast__close" aria-label="Dismiss" onClick={() => onDismiss(toast.id)}>
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
