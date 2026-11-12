import { useCallback, useEffect, useState } from "react";
import { Clock, Play, RefreshCw, ScrollText, Trash2 } from "lucide-react";
import { LOG_LEVELS, type LogLevel, type RunDetail, type RunSummary } from "../../../shared/types/api";
import { api, errorMessage } from "../../api/client";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
import { cx } from "../../utils/cx";
import { formatDateTime, formatDuration, formatRelativeTime } from "../../utils/format";
import {
  Badge,
  EmptyState,
  IconButton,
  LogConsole,
  SegmentedControl,
  Spinner,
  StatusPill,
  type SegmentedOption,
} from "../ui";
import "./LogsTabView.scss";

interface LogsTabViewProps {
  projectId: string;
  activeRunId: string | null;
}

type FilterLevel = LogLevel | "all";

export function LogsTabView({ projectId, activeRunId }: LogsTabViewProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(activeRunId);
  const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
  const [levelFilter, setLevelFilter] = useState<FilterLevel>("all");
  const [loading, setLoading] = useState(true);

  const loadRuns = useCallback(async () => {
    try {
      const list = await api.runs.list(projectId, { limit: 100 });
      setRuns(list);
      setSelectedRunId((current) => {
        if (current && list.some((r) => r.id === current)) return current;
        return list[0]?.id ?? null;
      });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    setLoading(true);
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (activeRunId) {
      setSelectedRunId(activeRunId);
      void loadRuns();
    }
  }, [activeRunId, loadRuns]);

  useEffect(() => {
    if (!selectedRunId) {
      setRunDetail(null);
      return;
    }

    let cancelled = false;
    const fetchDetail = async () => {
      try {
        const detail = await api.runs.get(selectedRunId);
        if (!cancelled) setRunDetail(detail);
      } catch {
        return;
      }
    };

    void fetchDetail();

    const interval = window.setInterval(() => {
      void fetchDetail();
      void loadRuns();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedRunId, loadRuns]);

  const handleClearLogs = async () => {
    const approved = await confirm({
      title: "Clear execution history?",
      message: "All finished run records and console logs for this project will be permanently deleted.",
      confirmLabel: "Clear history",
      tone: "danger",
    });
    if (!approved) return;

    try {
      await api.runs.clear(projectId);
      toast.success("Execution history cleared");
      setRuns([]);
      setSelectedRunId(null);
      setRunDetail(null);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const filterOptions: readonly SegmentedOption<FilterLevel>[] = [
    { value: "all", label: `All (${runDetail?.logs.length ?? 0})` },
    ...LOG_LEVELS.map((level) => ({ value: level, label: level.toUpperCase() })),
  ];

  const filteredLogs =
    runDetail?.logs.filter((entry) => (levelFilter === "all" ? true : entry.level === levelFilter)) ?? [];

  return (
    <div className="logs-tab">
      <aside className="logs-tab__sidebar">
        <header className="logs-tab__sidebar-head">
          <span className="logs-tab__sidebar-title">
            Executions <span>{runs.length}</span>
          </span>
          <div className="logs-tab__sidebar-actions">
            <IconButton size="xs" label="Refresh runs" icon={<RefreshCw size={13} />} onClick={() => void loadRuns()} />
            <IconButton
              size="xs"
              tone="danger"
              label="Clear history"
              icon={<Trash2 size={13} />}
              disabled={runs.length === 0}
              onClick={() => void handleClearLogs()}
            />
          </div>
        </header>

        <div className="logs-tab__run-list">
          {loading ? (
            <div className="logs-tab__center">
              <Spinner />
            </div>
          ) : runs.length === 0 ? (
            <EmptyState compact description="No executions yet" />
          ) : (
            runs.map((run) => {
              const selected = run.id === selectedRunId;
              return (
                <button
                  key={run.id}
                  type="button"
                  className={cx("run-item", selected && "run-item--active")}
                  onClick={() => setSelectedRunId(run.id)}
                >
                  <div className="run-item__top">
                    <StatusPill status={run.status} />
                    <span className="run-item__trigger">
                      {run.trigger === "manual" ? <Play size={10} /> : <Clock size={10} />}
                      {run.trigger}
                    </span>
                    <Badge mono tone="neutral">
                      v{run.version}
                    </Badge>
                    <span className="run-item__duration">{formatDuration(run.durationMs)}</span>
                  </div>
                  <div className="run-item__bottom">
                    <span>{formatDateTime(run.startedAt)}</span>
                    <span>{run.logCount} lines</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="logs-tab__detail">
        {runDetail ? (
          <>
            <header className="logs-tab__toolbar">
              <div className="logs-tab__run-summary">
                <StatusPill status={runDetail.status} />
                <code className="logs-tab__run-id">{runDetail.id.slice(0, 8)}</code>
                <span className="logs-tab__run-meta">
                  v{runDetail.version} · {runDetail.trigger} · {formatRelativeTime(runDetail.startedAt)} ·{" "}
                  {formatDuration(runDetail.durationMs)}
                </span>
              </div>

              <SegmentedControl
                size="sm"
                value={levelFilter}
                options={filterOptions}
                onChange={setLevelFilter}
                ariaLabel="Filter log level"
              />
            </header>

            <LogConsole
              entries={filteredLogs}
              emptyText={
                runDetail.status === "running"
                  ? "Waiting for console output…"
                  : "No log entries match the selected filter"
              }
            />
          </>
        ) : (
          <EmptyState icon={<ScrollText size={18} />} title="No run selected" />
        )}
      </section>
    </div>
  );
}
