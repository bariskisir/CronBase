import { useEffect, useState, type FormEvent } from "react";
import { Copy, Eye, EyeOff, FileText, KeyRound, Moon, RefreshCw, Shield, Sliders, Sun } from "lucide-react";
import { LOG_LEVELS, type LogLevel, type Theme } from "../../../shared/types/api";
import { api, errorMessage } from "../../api/client";
import { useTheme } from "../../context/ThemeContext";
import { useToast } from "../../context/ToastContext";
import { cx } from "../../utils/cx";
import {
  Button,
  Field,
  IconButton,
  Modal,
  SegmentedControl,
  Select,
  Switch,
  TextInput,
  type SegmentedOption,
  type SelectOption,
} from "../ui";
import "./AppSettingsModal.scss";

interface AppSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type SettingsTab = "preferences" | "security" | "logs";

const THEME_OPTIONS: readonly SegmentedOption<Theme>[] = [
  { value: "dark", label: "Dark", icon: <Moon size={13} /> },
  { value: "light", label: "Light", icon: <Sun size={13} /> },
];

const LOG_LEVEL_OPTIONS: readonly SegmentedOption<LogLevel>[] = LOG_LEVELS.map((level) => ({
  value: level,
  label: level.toUpperCase(),
}));

export function AppSettingsModal({ open, onClose }: AppSettingsModalProps) {
  const { theme, setTheme, maskCredentials, setMaskCredentials } = useTheme();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>("preferences");
  const [logLevel, setLogLevel] = useState<LogLevel>("info");
  const [savingLevel, setSavingLevel] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [secretKey, setSecretKey] = useState("");
  const [revealSecretKey, setRevealSecretKey] = useState(false);
  const [savingSecretKey, setSavingSecretKey] = useState(false);

  const [logFiles, setLogFiles] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logsTruncated, setLogsTruncated] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRevealSecretKey(false);
    api.settings
      .get()
      .then((settings) => setLogLevel(settings.logLevel))
      .catch(() => undefined);
    api.settings
      .getSecretKey()
      .then((res) => setSecretKey(res.secretKey))
      .catch(() => undefined);
  }, [open]);

  useEffect(() => {
    if (!open || activeTab !== "logs") return;
    setLoadingLogs(true);
    api.settings
      .listAppLogs()
      .then((res) => {
        setLogFiles(res.files);
        const first = res.files[0] ?? "";
        setSelectedDate((current) => (current && res.files.includes(current) ? current : first));
      })
      .catch((error) => toast.error(errorMessage(error)))
      .finally(() => setLoadingLogs(false));
  }, [open, activeTab, toast]);

  useEffect(() => {
    if (!open || activeTab !== "logs" || !selectedDate) {
      setLogLines([]);
      return;
    }
    setLoadingLogs(true);
    api.settings
      .readAppLog(selectedDate)
      .then((res) => {
        setLogLines(res.lines);
        setLogsTruncated(res.truncated);
      })
      .catch((error) => toast.error(errorMessage(error)))
      .finally(() => setLoadingLogs(false));
  }, [open, activeTab, selectedDate, toast]);

  const handleLogLevelChange = async (nextLevel: LogLevel) => {
    setLogLevel(nextLevel);
    setSavingLevel(true);
    try {
      await api.settings.update({ logLevel: nextLevel });
      toast.success(`Log level: ${nextLevel.toUpperCase()}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingLevel(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }

    setSavingPassword(true);
    try {
      await api.auth.changePassword({ currentPassword, newPassword });
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSaveSecretKey = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = secretKey.trim();
    if (trimmed.length < 16) {
      toast.error("Secret key must be at least 16 characters");
      return;
    }

    setSavingSecretKey(true);
    try {
      const updated = await api.settings.updateSecretKey(trimmed);
      setSecretKey(updated);
      toast.success("Secret key updated");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingSecretKey(false);
    }
  };

  const handleRegenerateSecretKey = async () => {
    setSavingSecretKey(true);
    try {
      const regenerated = await api.settings.regenerateSecretKey();
      setSecretKey(regenerated);
      toast.success("Secret key regenerated");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingSecretKey(false);
    }
  };

  const handleCopySecretKey = async () => {
    try {
      await navigator.clipboard.writeText(secretKey);
      toast.info("Secret key copied");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const refreshLogContent = async () => {
    if (!selectedDate) return;
    setLoadingLogs(true);
    try {
      const res = await api.settings.readAppLog(selectedDate);
      setLogLines(res.lines);
      setLogsTruncated(res.truncated);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoadingLogs(false);
    }
  };

  const secretKeyVisible = !maskCredentials || revealSecretKey;
  const logFileOptions: SelectOption<string>[] = logFiles.map((date) => ({
    value: date,
    label: `app-${date}.log`,
  }));

  return (
    <Modal open={open} onClose={onClose} size="lg" flush title="Settings" icon={<Sliders size={15} />}>
      <div className="app-settings">
        <nav className="app-settings__nav" aria-label="Settings sections">
          <button
            type="button"
            className={cx("app-settings__nav-btn", activeTab === "preferences" && "app-settings__nav-btn--active")}
            onClick={() => setActiveTab("preferences")}
          >
            <Sliders size={14} />
            <span>Preferences</span>
          </button>

          <button
            type="button"
            className={cx("app-settings__nav-btn", activeTab === "security" && "app-settings__nav-btn--active")}
            onClick={() => setActiveTab("security")}
          >
            <Shield size={14} />
            <span>Security</span>
          </button>

          <button
            type="button"
            className={cx("app-settings__nav-btn", activeTab === "logs" && "app-settings__nav-btn--active")}
            onClick={() => setActiveTab("logs")}
          >
            <FileText size={14} />
            <span>System Logs</span>
          </button>
        </nav>

        <div className="app-settings__content">
          {activeTab === "preferences" && (
            <div className="settings-list">
              <div className="settings-row">
                <span className="settings-row__label">Theme</span>
                <SegmentedControl value={theme} options={THEME_OPTIONS} onChange={setTheme} ariaLabel="Theme" />
              </div>

              <div className="settings-row">
                <span className="settings-row__label">System Log Level</span>
                <SegmentedControl
                  value={logLevel}
                  options={LOG_LEVEL_OPTIONS}
                  onChange={(next) => void handleLogLevelChange(next)}
                  disabled={savingLevel}
                  ariaLabel="System log level"
                />
              </div>

              <div className="settings-row">
                <span className="settings-row__label">Mask Credentials</span>
                <Switch
                  checked={maskCredentials}
                  onChange={setMaskCredentials}
                  label={maskCredentials ? "On" : "Off"}
                  ariaLabel="Mask credentials"
                />
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="security-pane">
              <form className="security-pane__section" onSubmit={(event) => void handleSaveSecretKey(event)}>
                <Field label="Secret Key">
                  <div className="security-pane__key-row">
                    <TextInput
                      mono
                      type={secretKeyVisible ? "text" : "password"}
                      value={secretKey}
                      onChange={(event) => setSecretKey(event.target.value)}
                      minLength={16}
                      leadingIcon={<KeyRound size={14} />}
                      wrapperClassName="security-pane__key-input"
                      trailing={
                        maskCredentials ? (
                          <IconButton
                            size="xs"
                            label={revealSecretKey ? "Hide key" : "Show key"}
                            icon={revealSecretKey ? <EyeOff size={14} /> : <Eye size={14} />}
                            onClick={() => setRevealSecretKey((current) => !current)}
                          />
                        ) : undefined
                      }
                      required
                    />
                    <Button
                      variant="secondary"
                      size="md"
                      icon={<Copy size={13} />}
                      onClick={() => void handleCopySecretKey()}
                    >
                      Copy
                    </Button>
                    <Button
                      variant="secondary"
                      size="md"
                      icon={<RefreshCw size={13} />}
                      onClick={() => void handleRegenerateSecretKey()}
                      disabled={savingSecretKey}
                    >
                      Rotate
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      loading={savingSecretKey}
                      disabled={secretKey.trim().length < 16}
                    >
                      Save
                    </Button>
                  </div>
                </Field>
              </form>

              <div className="security-pane__divider" />

              <form className="security-pane__section" onSubmit={(event) => void handlePasswordSubmit(event)}>
                <Field label="Current Password" htmlFor="sec-current-password">
                  <TextInput
                    id="sec-current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </Field>

                <Field label="New Password" htmlFor="sec-new-password">
                  <TextInput
                    id="sec-new-password"
                    type="text"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    minLength={8}
                    autoComplete="off"
                    spellCheck={false}
                    required
                  />
                </Field>

                <div className="security-pane__actions">
                  <Button
                    type="submit"
                    variant="primary"
                    loading={savingPassword}
                    disabled={!currentPassword || !newPassword}
                  >
                    {savingPassword ? "Updating…" : "Update password"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {activeTab === "logs" && (
            <div className="system-logs">
              <div className="system-logs__toolbar">
                <Select
                  value={selectedDate}
                  options={logFileOptions}
                  onChange={setSelectedDate}
                  placeholder="No log files"
                  mono
                  size="sm"
                  disabled={logFiles.length === 0}
                  className="system-logs__select"
                  ariaLabel="Log file"
                />
                {logsTruncated && <span className="system-logs__hint">Last 1,000 lines</span>}
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<RefreshCw size={13} />}
                  onClick={() => void refreshLogContent()}
                  disabled={loadingLogs || !selectedDate}
                >
                  Refresh
                </Button>
              </div>

              <pre className="system-logs__viewer">
                {loadingLogs ? "Loading…" : logLines.length > 0 ? logLines.join("\n") : "No entries"}
              </pre>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
