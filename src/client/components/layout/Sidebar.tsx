import { useMemo, useState } from "react";
import { LogOut, Moon, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, Sun } from "lucide-react";
import type { ProjectSummary } from "../../../shared/types/api";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { cx } from "../../utils/cx";
import { BrandMark, Button, IconButton, TextInput, type DotStatus } from "../ui";
import { ProjectAvatar } from "./ProjectAvatar";
import "./Sidebar.scss";

interface SidebarProps {
  projects: ProjectSummary[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onOpenCreate: () => void;
  onOpenSettings: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function projectStatus(project: ProjectSummary): DotStatus {
  if (project.lastRunStatus === "running") return "running";
  if (project.lastRunStatus === "error") return "error";
  return project.enabled ? "success" : "paused";
}

export function Sidebar({
  projects,
  selectedProjectId,
  onSelectProject,
  onOpenCreate,
  onOpenSettings,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [filter, setFilter] = useState("");

  const filteredProjects = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter((project) => project.name.toLowerCase().includes(query));
  }, [projects, filter]);

  return (
    <aside className={cx("sidebar", collapsed && "sidebar--collapsed")}>
      <div className="sidebar__header">
        <div className="sidebar__brand">
          <BrandMark size={26} />
          {!collapsed && <span className="sidebar__brand-name">CronBase</span>}
        </div>
        {!collapsed && (
          <Button variant="primary" size="xs" icon={<Plus size={13} />} onClick={onOpenCreate} title="New project">
            New
          </Button>
        )}
      </div>

      {collapsed ? (
        <div className="sidebar__collapsed-actions">
          <IconButton label="New project" icon={<Plus size={16} />} onClick={onOpenCreate} />
        </div>
      ) : (
        <div className="sidebar__search">
          <TextInput
            inputSize="sm"
            placeholder="Filter projects…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            leadingIcon={<Search size={13} />}
            aria-label="Filter projects"
          />
        </div>
      )}

      <nav className="sidebar__list" aria-label="Projects">
        {filteredProjects.length === 0 && !collapsed && (
          <p className="sidebar__empty">{projects.length === 0 ? "No projects yet" : "No matching projects"}</p>
        )}

        {filteredProjects.map((project) => {
          const active = project.id === selectedProjectId;
          return (
            <button
              key={project.id}
              type="button"
              className={cx("sidebar__item", active && "sidebar__item--active")}
              onClick={() => onSelectProject(project.id)}
              title={collapsed ? `${project.name} · ${project.scheduleDescription}` : undefined}
              aria-current={active ? "page" : undefined}
            >
              <ProjectAvatar name={project.name} status={projectStatus(project)} size={collapsed ? "md" : "sm"} />
              {!collapsed && (
                <span className="sidebar__item-text">
                  <span className="sidebar__item-name">{project.name}</span>
                  <span className="sidebar__item-meta">{project.scheduleDescription}</span>
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="sidebar__footer">
        <IconButton
          size="sm"
          label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          icon={collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          onClick={onToggleCollapse}
        />
        <IconButton
          size="sm"
          label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          icon={theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          onClick={toggleTheme}
        />
        <IconButton size="sm" label="Settings" icon={<Settings size={15} />} onClick={onOpenSettings} />
        <IconButton
          size="sm"
          tone="danger"
          label="Sign out"
          icon={<LogOut size={15} />}
          className="sidebar__logout"
          onClick={() => void logout()}
        />
      </div>
    </aside>
  );
}
