import { Code2, Database, KeyRound, ScrollText, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "../../utils/cx";
import "./ProjectTabs.scss";

export type WorkspaceTab = "code" | "env" | "sqlite" | "logs" | "settings";

const TABS: readonly { id: WorkspaceTab; label: string; icon: ReactNode }[] = [
  { id: "code", label: "Code", icon: <Code2 size={14} /> },
  { id: "env", label: "Environment", icon: <KeyRound size={14} /> },
  { id: "sqlite", label: "SQLite", icon: <Database size={14} /> },
  { id: "logs", label: "Logs", icon: <ScrollText size={14} /> },
  { id: "settings", label: "Settings", icon: <Settings2 size={14} /> },
];

interface ProjectTabsProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  hasUnsavedCode: boolean;
}

export function ProjectTabs({ activeTab, onSelectTab, hasUnsavedCode }: ProjectTabsProps) {
  return (
    <nav className="project-tabs" role="tablist" aria-label="Project sections">
      {TABS.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cx("project-tabs__tab", active && "project-tabs__tab--active")}
            onClick={() => onSelectTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.id === "code" && hasUnsavedCode && <span className="project-tabs__dirty" title="Unsaved changes" />}
          </button>
        );
      })}
    </nav>
  );
}
