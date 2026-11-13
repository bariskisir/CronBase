import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, History, RotateCcw, Trash2 } from "lucide-react";
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

const VERSIONS_PAGE_SIZE = 30;

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
  const [versionsTotal, setVersionsTotal] = useState(0);
  const [versionsOffset, setVersionsOffset] = useState(0);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [detail, setDetail] = useState<ProjectVersionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [deletingVersion, setDeletingVersion] = useState<number | null>(null);

  const loadVersions = useCallback(
    async (offset: number) => {
      setLoading(true);
      try {
        const page = await api.projects.listVersions(projectId, { limit: VERSIONS_PAGE_SIZE, offset });
        setVersions(page.items);
        setVersionsTotal(page.total);
        setSelectedVersion((current) => {
          if (current !== null && page.items.some((v) => v.version === current)) return current;
          return page.items[0]?.version ?? null;
        });
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [projectId, toast],
  );

  useEffect(() => {
    if (!open) return;
    setVersionsOffset(0);
    setSelectedVersion(null);
  }, [open, projectId]);

  useEffect(() => {
    if (!open) return;
    void loadVersions(versionsOffset);
  }, [open, versionsOffset, loadVersions]);

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
    if (versionsTotal <= 1) return;
    setDeletingVersion(version);
    try {
      const updatedProject = await api.projects.deleteVersion(projectId, version);
      if (updatedProject.currentVersion !== currentVersion) {
        onRestored(updatedProject.currentVersion, updatedProject.code);
      }
      onProjectUpdated(updatedProject);
      toast.success(`Deleted v${version}`);
      const nextOffset = versions.length === 1 && versionsOffset > 0 ? Math.max(0, versionsOffset - VERSIONS_PAGE_SIZE) : versionsOffset;
      if (nextOffset !== versionsOffset) {
        setVersionsOffset(nextOffset);
      } else {
        await loadVersions(versionsOffset);
      }
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
          <div className="version-history__list">
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

                    {versionsTotal > 1 && (
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
          </div>

          {versionsTotal > VERSIONS_PAGE_SIZE && (
            <footer className="version-history__pager">
              <span>
                {versionsOffset + 1}–{versionsOffset + versions.length} of {versionsTotal}
              </span>
              <div className="version-history__pager-controls">
                <Button
                  variant="secondary"
                  size="xs"
                  icon={<ChevronLeft size={13} />}
                  disabled={loading || versionsOffset === 0}
                  onClick={() => setVersionsOffset(Math.max(0, versionsOffset - VERSIONS_PAGE_SIZE))}
                >
                  Prev
                </Button>
                <Button
                  variant="secondary"
                  size="xs"
                  trailingIcon={<ChevronRight size={13} />}
                  disabled={loading || versionsOffset + VERSIONS_PAGE_SIZE >= versionsTotal}
                  onClick={() => setVersionsOffset(versionsOffset + VERSIONS_PAGE_SIZE)}
                >
                  Next
                </Button>
              </div>
            </footer>
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
