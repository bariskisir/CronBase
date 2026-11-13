import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Play, RefreshCw, ScrollText, Trash2 } from "lucide-react";
import { LOG_LEVELS, type LogLevel, type RunLogsPage, type RunSummary } from "../../../shared/types/api";
import { api, errorMessage } from "../../api/client";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
import { cx } from "../../utils/cx";
import { formatDateTime, formatDuration, formatRelativeTime } from "../../utils/format";
import {
  Badge,
  Button,
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

const RUNS_PAGE_SIZE = 25;
const LOGS_PAGE_SIZE = 100;

export function LogsTabView({ projectId, activeRunId }: LogsTabViewProps) {
  const toast = useToast();
  const confirm = useConfirm();

  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [runsTotal, setRunsTotal] = useState(0);
  const [runsOffset, setRunsOffset] = useState(0);
  const [loadingRuns, setLoadingRuns] = useState(true);

  const [selectedRunId, setSelectedRunId] = useState<string | null>(activeRunId);
  const [selectedRun, setSelectedRun] = useState<RunSummary | null>(null);
  const [logsPage, setLogsPage] = useState<RunLogsPage | null>(null);
  const [logsOffset, setLogsOffset] = useState(0);
  const [levelFilter, setLevelFilter] = useState<FilterLevel>("all");

  useEffect(() => {
    setRunsOffset(0);
    setLogsOffset(0);
    setSelectedRunId(activeRunId);
    setSelectedRun(null);
    setLogsPage(null);
  }, [projectId, activeRunId]);

  const loadRuns = useCallback(async () => {
    try {
      const page = await api.runs.list(projectId, { limit: RUNS_PAGE_SIZE, offset: runsOffset });
      setRuns(page.items);
      setRunsTotal(page.total);
      setSelectedRunId((current) => {
        if (current) return current;
        return page.items[0]?.id ?? null;
      });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoadingRuns(false);
    }
  }, [projectId, runsOffset, toast]);

  useEffect(() => {
    setLoadingRuns(true);
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (activeRunId) {
      setSelectedRunId(activeRunId);
      setRunsOffset(0);
      setLogsOffset(0);
    }
  }, [activeRunId]);

  const fetchRunAndLogs = useCallback(async () => {
    if (!selectedRunId) {
      setSelectedRun(null);
      setLogsPage(null);
      return;
    }

    try {
      const [detail, logs] = await Promise.all([
        api.runs.get(selectedRunId),
        api.runs.logs(selectedRunId, {
          limit: LOGS_PAGE_SIZE,
          offset: logsOffset,
          level: levelFilter === "all" ? undefined : levelFilter,
        }),
      ]);
      setSelectedRun(detail);
      setLogsPage(logs);
    } catch {
      return;
    }
  }, [selectedRunId, logsOffset, levelFilter]);

  useEffect(() => {
    void fetchRunAndLogs();
  }, [fetchRunAndLogs]);

  useEffect(() => {
    const isSelectedRunning = selectedRun?.status === "running" || (activeRunId !== null && activeRunId === selectedRunId);
    const interval = window.setInterval(() => {
      void loadRuns();
      if (isSelectedRunning) {
        void fetchRunAndLogs();
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [loadRuns, fetchRunAndLogs, selectedRun?.status, activeRunId, selectedRunId]);

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
      setRunsOffset(0);
      setLogsOffset(0);
      setSelectedRunId(null);
      setSelectedRun(null);
      setLogsPage(null);
      await loadRuns();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const handleSelectRun = (run: RunSummary) => {
    if (run.id === selectedRunId) return;
    setSelectedRunId(run.id);
    setSelectedRun(run);
    setLogsOffset(0);
  };

  const handleLevelChange = (nextLevel: FilterLevel) => {
    setLevelFilter(nextLevel);
    setLogsOffset(0);
  };

  const filterOptions: readonly SegmentedOption<FilterLevel>[] = [
    { value: "all", label: `All (${logsPage?.totalAll ?? selectedRun?.logCount ?? 0})` },
    ...LOG_LEVELS.map((level) => ({ value: level, label: level.toUpperCase() })),
  ];

  const entries = logsPage?.items ?? [];
  const totalLogs = logsPage?.total ?? 0;

  return (
    <div className="logs-tab">
      <aside className="logs-tab__sidebar">
        <header className="logs-tab__sidebar-head">
          <span className="logs-tab__sidebar-title">
            Executions <span>{runsTotal}</span>
          </span>
          <div className="logs-tab__sidebar-actions">
            <IconButton
              size="xs"
              label="Refresh runs"
              icon={<RefreshCw size={13} />}
              onClick={() => {
                void loadRuns();
                void fetchRunAndLogs();
              }}
            />
            <IconButton
              size="xs"
              tone="danger"
              label="Clear history"
              icon={<Trash2 size={13} />}
              disabled={runsTotal === 0}
              onClick={() => void handleClearLogs()}
            />
          </div>
        </header>

        <div className="logs-tab__run-list">
          {loadingRuns ? (
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
                  onClick={() => handleSelectRun(run)}
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

        {runsTotal > RUNS_PAGE_SIZE && (
          <footer className="logs-tab__pager-footer">
            <span className="logs-tab__pager-range">
              {runs.length === 0 ? 0 : runsOffset + 1}–{runsOffset + runs.length} of {runsTotal}
            </span>
            <div className="logs-tab__pager-controls">
              <Button
                variant="secondary"
                size="xs"
                icon={<ChevronLeft size={13} />}
                disabled={runsOffset === 0}
                onClick={() => setRunsOffset(Math.max(0, runsOffset - RUNS_PAGE_SIZE))}
              >
                Prev
              </Button>
              <Button
                variant="secondary"
                size="xs"
                trailingIcon={<ChevronRight size={13} />}
                disabled={runsOffset + RUNS_PAGE_SIZE >= runsTotal}
                onClick={() => setRunsOffset(runsOffset + RUNS_PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </footer>
        )}
      </aside>

      <section className="logs-tab__detail">
        {selectedRun ? (
          <>
            <header className="logs-tab__toolbar">
              <div className="logs-tab__run-summary">
                <StatusPill status={selectedRun.status} />
                <code className="logs-tab__run-id">{selectedRun.id.slice(0, 8)}</code>
                <span className="logs-tab__run-meta">
                  v{selectedRun.version} · {selectedRun.trigger} · {formatRelativeTime(selectedRun.startedAt)} ·{" "}
                  {formatDuration(selectedRun.durationMs)}
                </span>
              </div>

              <SegmentedControl
                size="sm"
                value={levelFilter}
                options={filterOptions}
                onChange={handleLevelChange}
                ariaLabel="Filter log level"
              />
            </header>

            <LogConsole
              entries={entries}
              emptyText={
                selectedRun.status === "running"
                  ? "Waiting for console output…"
                  : "No log entries match the selected filter"
              }
            />

            {totalLogs > LOGS_PAGE_SIZE && (
              <footer className="logs-tab__pager-footer">
                <span className="logs-tab__pager-range">
                  {entries.length === 0 ? 0 : logsOffset + 1}–{logsOffset + entries.length} of {totalLogs} lines
                </span>
                <div className="logs-tab__pager-controls">
                  <Button
                    variant="secondary"
                    size="xs"
                    icon={<ChevronLeft size={13} />}
                    disabled={logsOffset === 0}
                    onClick={() => setLogsOffset(Math.max(0, logsOffset - LOGS_PAGE_SIZE))}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="secondary"
                    size="xs"
                    trailingIcon={<ChevronRight size={13} />}
                    disabled={logsOffset + LOGS_PAGE_SIZE >= totalLogs}
                    onClick={() => setLogsOffset(logsOffset + LOGS_PAGE_SIZE)}
                  >
                    Next
                  </Button>
                </div>
              </footer>
            )}
          </>
        ) : (
          <EmptyState icon={<ScrollText size={18} />} title="No run selected" />
        )}
      </section>
    </div>
  );
}
