import { useEffect, useState, type FormEvent } from "react";
import { Check, History, Pencil, Play, Save, X } from "lucide-react";
import type { ProjectDetail } from "../../../shared/types/api";
import { api, errorMessage } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { cx } from "../../utils/cx";
import { Badge, Button, IconButton, TextInput } from "../ui";
import "./ProjectHeader.scss";

interface ProjectHeaderProps {
  project: ProjectDetail;
  hasUnsavedCode: boolean;
  savingCode: boolean;
  running: boolean;
  onSaveCode: () => void;
  onRun: () => void;
  onOpenHistory: () => void;
  onProjectUpdated: (updated: ProjectDetail) => void;
}

export function ProjectHeader({
  project,
  hasUnsavedCode,
  savingCode,
  running,
  onSaveCode,
  onRun,
  onOpenHistory,
  onProjectUpdated,
}: ProjectHeaderProps) {
  const toast = useToast();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(project.name);

  useEffect(() => {
    setNameInput(project.name);
    setEditingName(false);
  }, [project.id, project.name]);

  const cancelRename = () => {
    setEditingName(false);
    setNameInput(project.name);
  };

  const handleRenameSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === project.name) {
      cancelRename();
      return;
    }

    try {
      const updated = await api.projects.update(project.id, { name: trimmed });
      onProjectUpdated(updated);
      toast.success("Project renamed");
      setEditingName(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <header className="project-header">
      <div className="project-header__identity">
        {editingName ? (
          <form className="project-header__rename" onSubmit={(event) => void handleRenameSubmit(event)}>
            <TextInput
              inputSize="sm"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              onKeyDown={(event) => event.key === "Escape" && cancelRename()}
              maxLength={80}
              aria-label="Project name"
              autoFocus
            />
            <IconButton type="submit" size="sm" label="Save name" icon={<Check size={15} />} />
            <IconButton size="sm" label="Cancel" icon={<X size={15} />} onClick={cancelRename} />
          </form>
        ) : (
          <div className="project-header__title-group">
            <h1 className="project-header__name">{project.name}</h1>
            <span className="project-header__sep" aria-hidden="true">
              /
            </span>
            <code className="project-header__file">main.ts</code>
            <IconButton
              size="xs"
              label="Rename project"
              icon={<Pencil size={12} />}
              className="project-header__edit-btn"
              onClick={() => setEditingName(true)}
            />
          </div>
        )}
      </div>

      <div className="project-header__actions">
        <Button
          variant="ghost"
          size="sm"
          icon={<History size={15} />}
          onClick={onOpenHistory}
          title="Version history"
          trailingIcon={
            <Badge mono tone="neutral">
              v{project.currentVersion}
            </Badge>
          }
        >
          <span className="project-header__label">History</span>
        </Button>

        <span className="project-header__divider" aria-hidden="true" />

        <Button
          variant="secondary"
          size="sm"
          icon={<Save size={14} />}
          onClick={onSaveCode}
          loading={savingCode}
          disabled={!hasUnsavedCode}
          title="Save main.ts (Ctrl+S)"
          className={cx(hasUnsavedCode && "project-header__save--dirty")}
        >
          {savingCode ? "Saving…" : hasUnsavedCode ? "Save *" : "Saved"}
        </Button>

        <Button
          variant="primary"
          size="sm"
          icon={<Play size={13} fill="currentColor" />}
          onClick={onRun}
          loading={running}
          title="Run main.ts (Ctrl+Enter)"
        >
          {running ? "Running…" : "Run"}
        </Button>
      </div>
    </header>
  );
}
