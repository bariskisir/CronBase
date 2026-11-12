import type { ProjectDetail, RunDetail } from "../../../shared/types/api";
import { BottomLogsDrawer } from "../editor/BottomLogsDrawer";
import { CodeEditor } from "../editor/CodeEditor";
import { ScheduleBar } from "../editor/ScheduleBar";
import "./CodeTabView.scss";

interface CodeTabViewProps {
  project: ProjectDetail;
  draftCode: string;
  onDraftChange: (code: string) => void;
  onSave: () => void;
  onRun: () => void;
  onProjectUpdated: (project: ProjectDetail) => void;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  latestRun: RunDetail | null;
  onOpenFullLogs: () => void;
}

export function CodeTabView({
  project,
  draftCode,
  onDraftChange,
  onSave,
  onRun,
  onProjectUpdated,
  drawerOpen,
  onToggleDrawer,
  latestRun,
  onOpenFullLogs,
}: CodeTabViewProps) {
  return (
    <div className="code-tab">
      <ScheduleBar project={project} onUpdated={onProjectUpdated} />

      <div className="code-tab__editor">
        <CodeEditor value={draftCode} onChange={onDraftChange} onSave={onSave} onRun={onRun} />
      </div>

      <BottomLogsDrawer
        open={drawerOpen}
        onToggle={onToggleDrawer}
        latestRun={latestRun}
        onOpenFullLogs={onOpenFullLogs}
      />
    </div>
  );
}
