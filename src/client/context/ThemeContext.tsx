import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Theme } from "../../shared/types/api";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

const STORAGE_KEY = "cronbase.theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  maskCredentials: boolean;
  setMaskCredentials: (mask: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#242526" : "#fafafd");
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    return;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { status, mustChangePassword } = useAuth();
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [maskCredentials, setMaskCredentialsState] = useState<boolean>(false);

  const canSyncSettings = status === "authenticated" && !mustChangePassword;

  useEffect(() => applyTheme(theme), [theme]);

  useEffect(() => {
    if (!canSyncSettings) return;
    api.settings
      .get()
      .then((settings) => {
        setThemeState(settings.theme);
        setMaskCredentialsState(settings.maskCredentials);
      })
      .catch(() => undefined);
  }, [canSyncSettings]);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      if (canSyncSettings) void api.settings.update({ theme: next }).catch(() => undefined);
    },
    [canSyncSettings],
  );

  const toggleTheme = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme, setTheme]);

  const setMaskCredentials = useCallback(
    (next: boolean) => {
      setMaskCredentialsState(next);
      if (canSyncSettings) void api.settings.update({ maskCredentials: next }).catch(() => undefined);
    },
    [canSyncSettings],
  );

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, maskCredentials, setMaskCredentials }),
    [theme, setTheme, toggleTheme, maskCredentials, setMaskCredentials],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
