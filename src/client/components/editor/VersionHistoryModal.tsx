import { useEffect, useState } from "react";
import { History, RotateCcw, Trash2 } from "lucide-react";
import type { ProjectDetail, ProjectVersionDetail, ProjectVersionSummary } from "../../../shared/types/api";
import { api, errorMessage } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { cx } from "../../utils/cx";
import { formatBytes, formatDateTime, formatRelativeTime } from "../../utils/format";
import { Badge, Button, EmptyState, Modal, Spinner } from "../ui";
import { CodeEditor } from "./CodeEditor";
import "./VersionHistoryModal.scss";

interface VersionHistoryModalProps {
  projectId: string;
  currentVersion: number;
  open: boolean;
  onClose: () => void;
  onRestored: (version: number, code: string) => void;
  onProjectUpdated: (updated: ProjectDetail) => void;
}

export function VersionHistoryModal({
  projectId,
  currentVersion,
  open,
  onClose,
  onRestored,
  onProjectUpdated,
}: VersionHistoryModalProps) {
  const toast = useToast();
  const [versions, setVersions] = useState<ProjectVersionSummary[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [detail, setDetail] = useState<ProjectVersionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [deletingVersion, setDeletingVersion] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.projects
      .listVersions(projectId)
      .then((list) => {
        setVersions(list);
        setSelectedVersion(list[0]?.version ?? null);
      })
      .catch((error) => toast.error(errorMessage(error)))
      .finally(() => setLoading(false));
  }, [open, projectId, toast]);

  useEffect(() => {
    if (!open || selectedVersion === null) {
      setDetail(null);
      return;
    }
    api.projects
      .getVersion(projectId, selectedVersion)
      .then(setDetail)
      .catch((error) => toast.error(errorMessage(error)));
  }, [open, projectId, selectedVersion, toast]);

  const handleRestore = async () => {
    if (!detail) return;
    setRestoring(true);
    try {
      const result = await api.projects.restoreVersion(projectId, detail.version);
      toast.success(
        result.created
          ? `Restored v${detail.version} as v${result.version}`
          : `v${detail.version} is already identical to current code`,
      );
      onRestored(result.version, detail.code);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteVersion = async (version: number) => {
    if (versions.length <= 1) return;
    setDeletingVersion(version);
    try {
      const updatedProject = await api.projects.deleteVersion(projectId, version);
      const remaining = versions.filter((v) => v.version !== version);
      setVersions(remaining);
      if (selectedVersion === version) {
        setSelectedVersion(remaining[0]?.version ?? null);
      }
      if (updatedProject.currentVersion !== currentVersion) {
        onRestored(updatedProject.currentVersion, updatedProject.code);
      }
      onProjectUpdated(updatedProject);
      toast.success(`Deleted v${version}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeletingVersion(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="xl" flush title="Version History" icon={<History size={15} />}>
      <div className="version-history">
        <aside className="version-history__sidebar">
          {loading ? (
            <div className="version-history__loading">
              <Spinner />
            </div>
          ) : versions.length === 0 ? (
            <EmptyState compact description="No versions saved yet" />
          ) : (
            versions.map((item) => {
              const isCurrent = item.version === currentVersion;
              const isSelected = item.version === selectedVersion;
              return (
                <div
                  key={item.version}
                  className={cx("version-row", isSelected && "version-row--active")}
                  onClick={() => setSelectedVersion(item.version)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedVersion(item.version);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="version-row__body">
                    <div className="version-row__head">
                      <span className="version-row__tag">v{item.version}</span>
                      {isCurrent && <Badge tone="accent">Current</Badge>}
                      <span className="version-row__size">{formatBytes(item.size)}</span>
                    </div>
                    <div className="version-row__time" title={formatDateTime(item.createdAt)}>
                      {formatRelativeTime(item.createdAt)} · {formatDateTime(item.createdAt)}
                    </div>
                  </div>

                  {versions.length > 1 && (
                    <button
                      type="button"
                      className="version-row__delete"
                      title={`Delete v${item.version}`}
                      aria-label={`Delete v${item.version}`}
                      disabled={deletingVersion === item.version}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDeleteVersion(item.version);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </aside>

        <section className="version-history__main">
          {detail ? (
            <>
              <header className="version-history__toolbar">
                <div className="version-history__toolbar-meta">
                  <strong>v{detail.version}</strong>
                  <span>Saved {formatDateTime(detail.createdAt)}</span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<RotateCcw size={13} />}
                  loading={restoring}
                  disabled={detail.version === currentVersion}
                  onClick={() => void handleRestore()}
                >
                  {restoring ? "Restoring…" : `Restore v${detail.version}`}
                </Button>
              </header>
              <div className="version-history__editor">
                <CodeEditor value={detail.code} onChange={() => undefined} readOnly />
              </div>
            </>
          ) : (
            <EmptyState compact description="Select a version to preview its source code" />
          )}
        </section>
      </div>
    </Modal>
  );
}
