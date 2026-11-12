import { ForceChangePasswordView } from "./components/auth/ForceChangePasswordView";
import { LoginView } from "./components/auth/LoginView";
import { AppLayout } from "./components/layout/AppLayout";
import { BrandMark, Spinner } from "./components/ui";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ConfirmProvider } from "./context/ConfirmContext";
import { ProjectsProvider } from "./context/ProjectsContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import "./App.scss";

function RootContent() {
  const { status, mustChangePassword } = useAuth();

  if (status === "loading") {
    return (
      <div className="app-splash">
        <BrandMark size={36} />
        <div className="app-splash__row">
          <Spinner size="sm" />
          <span>Loading CronBase…</span>
        </div>
      </div>
    );
  }

  if (status === "anonymous") {
    return <LoginView />;
  }

  if (mustChangePassword) {
    return <ForceChangePasswordView />;
  }

  return (
    <ProjectsProvider>
      <AppLayout />
    </ProjectsProvider>
  );
}

export function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <ConfirmProvider>
            <RootContent />
          </ConfirmProvider>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
