import { useEffect, useState, type FormEvent } from "react";
import { Save, Trash2 } from "lucide-react";
import { LOG_LEVELS, type LogLevel, type ProjectDetail } from "../../../shared/types/api";
import { api, errorMessage } from "../../api/client";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
import { Button, Panel, SegmentedControl, TextInput, type SegmentedOption } from "../ui";
import "./ProjectSettingsTabView.scss";

interface ProjectSettingsTabViewProps {
  project: ProjectDetail;
  onUpdated: (project: ProjectDetail) => void;
  onDeleted: () => void;
}

const LOG_LEVEL_OPTIONS: readonly SegmentedOption<LogLevel>[] = LOG_LEVELS.map((level) => ({
  value: level,
  label: level.toUpperCase(),
}));

export function ProjectSettingsTabView({ project, onUpdated, onDeleted }: ProjectSettingsTabViewProps) {
  const toast = useToast();
  const confirm = useConfirm();

  const [name, setName] = useState(project.name);
  const [saving, setSaving] = useState(false);
  const [savingLevel, setSavingLevel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setName(project.name);
  }, [project.name]);

  const handleRename = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === project.name) return;

    setSaving(true);
    try {
      const updated = await api.projects.update(project.id, { name: trimmed });
      onUpdated(updated);
      toast.success("Project renamed");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleLogLevelChange = async (nextLevel: LogLevel) => {
    if (nextLevel === project.logLevel) return;
    setSavingLevel(true);
    try {
      const updated = await api.projects.update(project.id, { logLevel: nextLevel });
      onUpdated(updated);
      toast.success(`Project log level: ${nextLevel.toUpperCase()}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingLevel(false);
    }
  };

  const handleDelete = async () => {
    const approved = await confirm({
      title: `Delete "${project.name}"?`,
      message: (
        <>
          This will permanently delete <strong>{project.name}</strong>, its version history, execution logs, and its
          SQLite database.
        </>
      ),
      confirmLabel: "Delete project",
      tone: "danger",
    });
    if (!approved) return;

    setDeleting(true);
    try {
      await api.projects.remove(project.id);
      toast.success(`Project "${project.name}" deleted`);
      onDeleted();
    } catch (error) {
      toast.error(errorMessage(error));
      setDeleting(false);
    }
  };

  return (
    <div className="project-settings-tab">
      <div className="project-settings-tab__stack">
        <Panel title="Project Name">
          <form className="project-settings-tab__rename" onSubmit={(event) => void handleRename(event)}>
            <TextInput
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              aria-label="Project name"
              required
            />
            <Button
              type="submit"
              variant="primary"
              icon={<Save size={14} />}
              loading={saving}
              disabled={!name.trim() || name.trim() === project.name}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </form>
        </Panel>

        <Panel
          title="Log Level"
          actions={
            <SegmentedControl
              value={project.logLevel}
              options={LOG_LEVEL_OPTIONS}
              onChange={(next) => void handleLogLevelChange(next)}
              disabled={savingLevel}
              ariaLabel="Project log level"
            />
          }
        />

        <Panel
          tone="danger"
          title="Delete Project"
          actions={
            <Button variant="danger" icon={<Trash2 size={14} />} loading={deleting} onClick={() => void handleDelete()}>
              {deleting ? "Deleting…" : "Delete project"}
            </Button>
          }
        />
      </div>
    </div>
  );
}
