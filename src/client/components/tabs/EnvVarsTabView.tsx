import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, Pencil, Plus, Trash2, X } from "lucide-react";
import type { EnvVar } from "../../../shared/types/api";
import { api, errorMessage } from "../../api/client";
import { useConfirm } from "../../context/ConfirmContext";
import { useTheme } from "../../context/ThemeContext";
import { useToast } from "../../context/ToastContext";
import { Badge, Button, EmptyState, IconButton, Panel, Spinner, TextInput } from "../ui";
import "./EnvVarsTabView.scss";

interface EnvVarsTabViewProps {
  projectId: string;
}

export function EnvVarsTabView({ projectId }: EnvVarsTabViewProps) {
  const { maskCredentials } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();

  const [vars, setVars] = useState<EnvVar[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState("");
  const [editValue, setEditValue] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const loadVars = useCallback(async () => {
    setLoading(true);
    try {
      setVars(await api.env.list(projectId));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    void loadVars();
  }, [loadVars]);

  const toggleReveal = (id: string) => {
    setRevealedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    const key = newKey.trim();
    if (!key) return;

    setAdding(true);
    try {
      const created = await api.env.create(projectId, { key, value: newValue });
      setVars((current) => [...current, created].sort((a, b) => a.key.localeCompare(b.key)));
      setNewKey("");
      setNewValue("");
      toast.success(`Variable "${created.key}" added`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (item: EnvVar) => {
    setEditingId(item.id);
    setEditKey(item.key);
    setEditValue(item.value);
  };

  const handleSaveEdit = async (id: string) => {
    setSavingEdit(true);
    try {
      const updated = await api.env.update(projectId, id, { key: editKey.trim(), value: editValue });
      setVars((current) => current.map((v) => (v.id === id ? updated : v)).sort((a, b) => a.key.localeCompare(b.key)));
      setEditingId(null);
      toast.success(`Updated "${updated.key}"`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (item: EnvVar) => {
    const approved = await confirm({
      title: `Delete ${item.key}?`,
      message: (
        <>
          Variable <code>{item.key}</code> will be removed from this project.
        </>
      ),
      confirmLabel: "Delete variable",
      tone: "danger",
    });
    if (!approved) return;

    try {
      await api.env.remove(projectId, item.id);
      setVars((current) => current.filter((v) => v.id !== item.id));
      toast.success(`Deleted "${item.key}"`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const handleCopy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.info(`Copied ${key}`);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <div className="env-tab">
      <Panel title="Environment Variables">
        <form className="env-create" onSubmit={(event) => void handleAdd(event)}>
          <TextInput
            mono
            placeholder="KEY"
            value={newKey}
            onChange={(event) => setNewKey(event.target.value)}
            required
          />
          <TextInput mono placeholder="Value" value={newValue} onChange={(event) => setNewValue(event.target.value)} />
          <Button type="submit" variant="primary" icon={<Plus size={14} />} loading={adding} disabled={!newKey.trim()}>
            {adding ? "Adding…" : "Add Variable"}
          </Button>
        </form>

        <div className="env-list">
          {loading ? (
            <div className="env-list__loading">
              <Spinner />
            </div>
          ) : vars.length === 0 ? (
            <EmptyState compact description="No environment variables configured" />
          ) : (
            vars.map((item) => {
              const isEditing = editingId === item.id;
              const isRevealed = !maskCredentials || revealedIds.has(item.id);

              if (isEditing) {
                return (
                  <div key={item.id} className="env-row env-row--editing">
                    <TextInput
                      mono
                      value={editKey}
                      onChange={(event) => setEditKey(event.target.value)}
                      placeholder="KEY"
                    />
                    <TextInput
                      mono
                      value={editValue}
                      onChange={(event) => setEditValue(event.target.value)}
                      placeholder="Value"
                      autoFocus
                    />
                    <div className="env-row__actions">
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Check size={13} />}
                        loading={savingEdit}
                        onClick={() => void handleSaveEdit(item.id)}
                      >
                        Save
                      </Button>
                      <IconButton
                        size="sm"
                        label="Cancel"
                        icon={<X size={14} />}
                        disabled={savingEdit}
                        onClick={() => setEditingId(null)}
                      />
                    </div>
                  </div>
                );
              }

              return (
                <div key={item.id} className="env-row">
                  <div className="env-row__key">
                    <KeyRound size={13} className="env-row__key-icon" />
                    <code>{item.key}</code>
                  </div>

                  <div className="env-row__value">
                    {item.value === "" ? (
                      <Badge tone="warning">Empty</Badge>
                    ) : (
                      <code className="env-row__secret">{isRevealed ? item.value : "••••••••••••••••••••"}</code>
                    )}
                  </div>

                  <div className="env-row__actions">
                    {item.value !== "" && (
                      <>
                        {maskCredentials && (
                          <IconButton
                            size="sm"
                            label={isRevealed ? "Hide value" : "Reveal value"}
                            icon={isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                            onClick={() => toggleReveal(item.id)}
                          />
                        )}
                        <IconButton
                          size="sm"
                          label="Copy value"
                          icon={<Copy size={14} />}
                          onClick={() => void handleCopy(item.value, item.key)}
                        />
                      </>
                    )}
                    <IconButton
                      size="sm"
                      label="Edit variable"
                      icon={<Pencil size={14} />}
                      onClick={() => startEdit(item)}
                    />
                    <IconButton
                      size="sm"
                      tone="danger"
                      label="Delete variable"
                      icon={<Trash2 size={14} />}
                      onClick={() => void handleDelete(item)}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Panel>
    </div>
  );
}
