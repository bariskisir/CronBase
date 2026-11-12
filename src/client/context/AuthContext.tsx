import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, clearAuthTokens, hasStoredTokens, onUnauthorized } from "../api/client";

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  mustChangePassword: boolean;
  login: (password: string) => Promise<void>;
  completeInitialPasswordChange: (newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    onUnauthorized(() => {
      setMustChangePassword(false);
      setStatus("anonymous");
    });
    if (!hasStoredTokens()) {
      setStatus("anonymous");
      return;
    }
    api.auth
      .session()
      .then((session) => {
        if (!session.authenticated) {
          clearAuthTokens();
          setMustChangePassword(false);
          setStatus("anonymous");
          return;
        }
        setMustChangePassword(session.mustChangePassword);
        setStatus("authenticated");
      })
      .catch(() => {
        clearAuthTokens();
        setMustChangePassword(false);
        setStatus("anonymous");
      });
  }, []);

  const login = useCallback(async (password: string) => {
    const tokens = await api.auth.login(password);
    setMustChangePassword(tokens.mustChangePassword);
    setStatus("authenticated");
  }, []);

  const completeInitialPasswordChange = useCallback(async (newPassword: string) => {
    const tokens = await api.auth.changePassword({ newPassword });
    setMustChangePassword(tokens.mustChangePassword);
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout();
    setMustChangePassword(false);
    setStatus("anonymous");
  }, []);

  const value = useMemo(
    () => ({ status, mustChangePassword, login, completeInitialPasswordChange, logout }),
    [status, mustChangePassword, login, completeInitialPasswordChange, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
