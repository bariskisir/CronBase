import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "../Button/Button";
import { Modal } from "../Modal/Modal";
import "./ConfirmDialog.scss";

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  tone?: "default" | "danger";
}

interface ConfirmDialogProps {
  options: ConfirmOptions | null;
  onSettle: (result: boolean) => void;
}

export function ConfirmDialog({ options, onSettle }: ConfirmDialogProps) {
  const danger = options?.tone === "danger";
  return (
    <Modal
      open={options !== null}
      onClose={() => onSettle(false)}
      size="sm"
      title={options?.title ?? ""}
      icon={danger ? <AlertTriangle size={15} className="confirm-dialog__danger-icon" /> : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={() => onSettle(false)}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={() => onSettle(true)} autoFocus>
            {options?.confirmLabel ?? "Confirm"}
          </Button>
        </>
      }
    >
      {options?.message && <div className="confirm-dialog__message">{options.message}</div>}
    </Modal>
  );
}
