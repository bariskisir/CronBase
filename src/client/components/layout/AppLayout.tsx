import { useCallback, useEffect, useState } from "react";
import { FolderPlus } from "lucide-react";
import type { ProjectDetail, RunDetail } from "../../../shared/types/api";
import { api, errorMessage } from "../../api/client";
import { useProjects } from "../../context/ProjectsContext";
import { useToast } from "../../context/ToastContext";
import { VersionHistoryModal } from "../editor/VersionHistoryModal";
import { CreateProjectModal } from "../modals/CreateProjectModal";
import { AppSettingsModal } from "../settings/AppSettingsModal";
import { CodeTabView } from "../tabs/CodeTabView";
import { EnvVarsTabView } from "../tabs/EnvVarsTabView";
import { LogsTabView } from "../tabs/LogsTabView";
import { ProjectSettingsTabView } from "../tabs/ProjectSettingsTabView";
import { SqliteTabView } from "../tabs/SqliteTabView";
import { BrandMark, Button, EmptyState, Spinner } from "../ui";
import { ProjectHeader } from "./ProjectHeader";
import { ProjectTabs, type WorkspaceTab } from "./ProjectTabs";
import { Sidebar } from "./Sidebar";
import "./AppLayout.scss";

const SIDEBAR_STORAGE_KEY = "cronbase.sidebarCollapsed";

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function AppLayout() {
  const { projects, loading: loadingList, refresh: refreshProjects, addProject } = useProjects();
  const toast = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [draftCode, setDraftCode] = useState("");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("code");

  const [savingCode, setSavingCode] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [latestRun, setLatestRun] = useState<RunDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      return;
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (projects.length === 0) return;
    if (!selectedId || !projects.some((p) => p.id === selectedId)) {
      setSelectedId(projects[0]?.id ?? null);
    }
  }, [projects, selectedId]);

  const loadProject = useCallback(
    async (id: string, syncDraft = true) => {
      try {
        const detail = await api.projects.get(id);
        setProject(detail);
        if (syncDraft) setDraftCode(detail.code);
        setRunning(detail.isRunning);

        const runs = await api.runs.list(id, { limit: 1 });
        setLatestRun(runs[0] ? await api.runs.get(runs[0].id) : null);
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },
    [toast],
  );

  useEffect(() => {
    if (!selectedId) {
      setProject(null);
      setLatestRun(null);
      return;
    }
    void loadProject(selectedId, true);
  }, [selectedId, loadProject]);

  useEffect(() => {
    if (!activeRunId || !selectedId) return;
    let cancelled = false;

    const timer = window.setInterval(async () => {
      try {
        const detail = await api.runs.get(activeRunId);
        if (cancelled) return;
        setLatestRun(detail);
        if (detail.status !== "running") {
          setRunning(false);
          setActiveRunId(null);
          void refreshProjects();
          void loadProject(selectedId, false);
        }
      } catch {
        setRunning(false);
        setActiveRunId(null);
      }
    }, 600);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeRunId, selectedId, refreshProjects, loadProject]);

  const hasUnsavedCode = project !== null && draftCode !== project.code;

  const handleSaveCode = useCallback(async (): Promise<boolean> => {
    if (!project) return false;
    if (draftCode === project.code) return true;

    setSavingCode(true);
    try {
      const result = await api.projects.saveCode(project.id, draftCode);
      setProject((current) => (current ? { ...current, code: draftCode, currentVersion: result.version } : current));
      if (result.created) toast.success(`Saved main.ts (v${result.version})`);
      void refreshProjects();
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    } finally {
      setSavingCode(false);
    }
  }, [project, draftCode, toast, refreshProjects]);

  const handleRun = useCallback(async () => {
    if (!project || running) return;

    if (draftCode !== project.code) {
      const saved = await handleSaveCode();
      if (!saved) return;
    }

    setRunning(true);
    setDrawerOpen(true);
    try {
      const { runId } = await api.runs.start(project.id);
      setActiveRunId(runId);
      setLatestRun(await api.runs.get(runId));
    } catch (error) {
      setRunning(false);
      toast.error(errorMessage(error));
    }
  }, [project, running, draftCode, handleSaveCode, toast]);

  const handleProjectUpdated = useCallback(
    (updated: ProjectDetail) => {
      setProject(updated);
      void refreshProjects();
    },
    [refreshProjects],
  );

  useEffect(() => {
    if (!project || activeTab !== "code" || createModalOpen || settingsModalOpen || historyModalOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const isMod = event.ctrlKey || event.metaKey;
      if (!isMod) return;

      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
        return;
      }

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSaveCode();
      } else if (event.key === "Enter") {
        event.preventDefault();
        void handleRun();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [project, activeTab, createModalOpen, settingsModalOpen, historyModalOpen, handleSaveCode, handleRun]);

  const renderWorkspace = () => {
    if (project) {
      return (
        <>
          <ProjectHeader
            project={project}
            hasUnsavedCode={hasUnsavedCode}
            savingCode={savingCode}
            running={running}
            onSaveCode={() => void handleSaveCode()}
            onRun={() => void handleRun()}
            onOpenHistory={() => setHistoryModalOpen(true)}
            onProjectUpdated={handleProjectUpdated}
          />
          <ProjectTabs activeTab={activeTab} onSelectTab={setActiveTab} hasUnsavedCode={hasUnsavedCode} />

          <div className="workspace__body">
            {activeTab === "code" && (
              <CodeTabView
                project={project}
                draftCode={draftCode}
                onDraftChange={setDraftCode}
                onSave={() => void handleSaveCode()}
                onRun={() => void handleRun()}
                onProjectUpdated={handleProjectUpdated}
                drawerOpen={drawerOpen}
                onToggleDrawer={() => setDrawerOpen((open) => !open)}
                latestRun={latestRun}
                onOpenFullLogs={() => setActiveTab("logs")}
              />
            )}
            {activeTab === "env" && <EnvVarsTabView projectId={project.id} />}
            {activeTab === "sqlite" && <SqliteTabView projectId={project.id} />}
            {activeTab === "logs" && <LogsTabView projectId={project.id} activeRunId={activeRunId} />}
            {activeTab === "settings" && (
              <ProjectSettingsTabView
                project={project}
                onUpdated={handleProjectUpdated}
                onDeleted={() => {
                  setSelectedId(null);
                  setProject(null);
                  void refreshProjects();
                }}
              />
            )}
          </div>
        </>
      );
    }

    if (loadingList || selectedId) {
      return (
        <div className="workspace__center">
          <Spinner size="lg" />
        </div>
      );
    }

    return (
      <div className="workspace__center">
        <EmptyState
          icon={<BrandMark size={24} />}
          title="No projects"
          action={
            <Button variant="primary" icon={<FolderPlus size={15} />} onClick={() => setCreateModalOpen(true)}>
              New project
            </Button>
          }
        />
      </div>
    );
  };

  return (
    <div className="app-shell">
      <Sidebar
        projects={projects}
        selectedProjectId={selectedId}
        onSelectProject={(id) => {
          setSelectedId(id);
          setActiveTab("code");
        }}
        onOpenCreate={() => setCreateModalOpen(true)}
        onOpenSettings={() => setSettingsModalOpen(true)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((collapsed) => !collapsed)}
      />

      <main className="workspace">{renderWorkspace()}</main>

      <CreateProjectModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={(created) => {
          addProject(created);
          setSelectedId(created.id);
          setProject(created);
          setDraftCode(created.code);
          setActiveTab("code");
          void refreshProjects();
        }}
      />

      <AppSettingsModal open={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} />

      {project && (
        <VersionHistoryModal
          projectId={project.id}
          currentVersion={project.currentVersion}
          open={historyModalOpen}
          onClose={() => setHistoryModalOpen(false)}
          onRestored={(version, code) => {
            setDraftCode(code);
            setProject((current) => (current ? { ...current, code, currentVersion: version } : current));
          }}
          onProjectUpdated={handleProjectUpdated}
        />
      )}
    </div>
  );
}
