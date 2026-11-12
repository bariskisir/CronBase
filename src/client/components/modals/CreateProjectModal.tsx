import { useState, type FormEvent } from "react";
import { FolderPlus } from "lucide-react";
import type { ProjectDetail } from "../../../shared/types/api";
import { api, errorMessage } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { Button, Field, Modal, TextInput } from "../ui";
import "./CreateProjectModal.scss";

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (project: ProjectDetail) => void;
}

export function CreateProjectModal({ open, onClose, onCreated }: CreateProjectModalProps) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      const created = await api.projects.create(trimmed);
      toast.success(`Project "${created.name}" created`);
      setName("");
      onCreated(created);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="New Project"
      icon={<FolderPlus size={15} />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-project-form"
            variant="primary"
            loading={submitting}
            disabled={!name.trim()}
          >
            {submitting ? "Creating…" : "Create project"}
          </Button>
        </>
      }
    >
      <form id="create-project-form" className="create-project-form" onSubmit={(event) => void handleSubmit(event)}>
        <Field label="Project name" htmlFor="new-project-name">
          <TextInput
            id="new-project-name"
            placeholder="Project name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            autoFocus
            required
          />
        </Field>
      </form>
    </Modal>
  );
}
