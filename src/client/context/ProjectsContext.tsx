import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ProjectSummary } from "../../shared/types/api";
import { api } from "../api/client";

interface ProjectsContextValue {
  projects: ProjectSummary[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

const REFRESH_INTERVAL_MS = 15_000;

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setProjects(await api.projects.list());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh().catch(() => undefined);
    const timer = window.setInterval(() => void refresh().catch(() => undefined), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const value = useMemo(() => ({ projects, loading, refresh }), [projects, loading, refresh]);
  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects(): ProjectsContextValue {
  const context = useContext(ProjectsContext);
  if (!context) throw new Error("useProjects must be used within ProjectsProvider");
  return context;
}
