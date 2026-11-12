import type { RunLogEntry } from "../../../../shared/types/api";
import { formatTimeOnly } from "../../../utils/format";
import { EmptyState } from "../EmptyState/EmptyState";
import "./LogConsole.scss";

interface LogConsoleProps {
  entries: readonly RunLogEntry[];
  emptyText: string;
}

export function LogConsole({ entries, emptyText }: LogConsoleProps) {
  if (entries.length === 0) {
    return (
      <div className="log-console log-console--empty">
        <EmptyState compact description={emptyText} />
      </div>
    );
  }

  return (
    <div className="log-console" role="log">
      {entries.map((entry) => (
        <div key={entry.id} className={`log-console__line log-console__line--${entry.level}`}>
          <span className="log-console__time">{formatTimeOnly(entry.createdAt)}</span>
          <span className={`log-console__level log-console__level--${entry.level}`}>{entry.level}</span>
          <pre className="log-console__msg">{entry.message}</pre>
        </div>
      ))}
    </div>
  );
}
