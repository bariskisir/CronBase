import { ChevronDown, ChevronUp, ExternalLink, Terminal } from "lucide-react";
import type { RunDetail } from "../../../shared/types/api";
import { formatDuration } from "../../utils/format";
import { Button, IconButton, Kbd, LogConsole, StatusDot, StatusPill } from "../ui";
import "./BottomLogsDrawer.scss";

interface BottomLogsDrawerProps {
  open: boolean;
  onToggle: () => void;
  latestRun: RunDetail | null;
  onOpenFullLogs: () => void;
}

export function BottomLogsDrawer({ open, onToggle, latestRun, onOpenFullLogs }: BottomLogsDrawerProps) {
  return (
    <div className="bottom-drawer">
      {open && (
        <section className="bottom-drawer__panel" aria-label="Latest execution output">
          <header className="bottom-drawer__header">
            <div className="bottom-drawer__meta">
              <span className="bottom-drawer__title">Console</span>
              {latestRun && (
                <>
                  <StatusPill status={latestRun.status} />
                  <span className="bottom-drawer__details">
                    v{latestRun.version} · {latestRun.trigger} · {formatDuration(latestRun.durationMs)}
                    {latestRun.logCount > latestRun.logs.length &&
                      ` · Last ${latestRun.logs.length} of ${latestRun.logCount} lines`}
                  </span>
                </>
              )}
            </div>
            <div className="bottom-drawer__actions">
              <Button variant="ghost" size="xs" trailingIcon={<ExternalLink size={11} />} onClick={onOpenFullLogs}>
                All runs
              </Button>
              <IconButton size="xs" label="Collapse console" icon={<ChevronDown size={14} />} onClick={onToggle} />
            </div>
          </header>

          <LogConsole
            entries={latestRun?.logs ?? []}
            emptyText={
              !latestRun
                ? "No executions yet"
                : latestRun.status === "running"
                  ? "Running script…"
                  : "No console output"
            }
          />
        </section>
      )}

      <footer className="status-bar">
        <button type="button" className="status-bar__console-btn" onClick={onToggle}>
          <Terminal size={12} />
          <span>Console</span>
          {latestRun && <StatusDot status={latestRun.status} title={`Last run: ${latestRun.status}`} />}
          {open ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>

        <div className="status-bar__right">
          <span className="status-bar__shortcut">
            <Kbd>Ctrl+S</Kbd> Save
          </span>
          <span className="status-bar__shortcut">
            <Kbd>Ctrl+Enter</Kbd> Run
          </span>
          <span className="status-bar__runtime">TypeScript · Node.js</span>
        </div>
      </footer>
    </div>
  );
}
