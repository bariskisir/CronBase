import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Info,
  KeyRound,
  Moon,
  RefreshCw,
  Shield,
  Sliders,
  Sun,
} from "lucide-react";
import { description as APP_DESCRIPTION, version as APP_VERSION } from "../../../../package.json";
import { LOG_LEVELS, type LogLevel, type Theme } from "../../../shared/types/api";
import { api, errorMessage } from "../../api/client";
import { useTheme } from "../../context/ThemeContext";
import { useToast } from "../../context/ToastContext";
import { cx } from "../../utils/cx";
import {
  Badge,
  BrandMark,
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

type SettingsTab = "preferences" | "security" | "logs" | "about";

const APP_NAME = "CronBase";
const APP_AUTHOR = "Barış Kısır";
const APP_AUTHOR_URL = "https://www.bariskisir.com";
const APP_REPO = "bariskisir/CronBase";
const APP_REPO_URL = "https://github.com/bariskisir/CronBase";

const THEME_OPTIONS: readonly SegmentedOption<Theme>[] = [
  { value: "dark", label: "Dark", icon: <Moon size={13} /> },
  { value: "light", label: "Light", icon: <Sun size={13} /> },
];

const LOG_LEVEL_OPTIONS: readonly SegmentedOption<LogLevel>[] = LOG_LEVELS.map((level) => ({
  value: level,
  label: level.toUpperCase(),
}));

const SYSTEM_LOGS_PAGE_SIZE = 100;

export function AppSettingsModal({ open, onClose }: AppSettingsModalProps) {
  const { theme, setTheme, maskCredentials, setMaskCredentials } = useTheme();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>("preferences");
  const [logLevel, setLogLevel] = useState<LogLevel>("info");
  const [savingLevel, setSavingLevel] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [secretKey, setSecretKey] = useState("");
  const [revealSecretKey, setRevealSecretKey] = useState(false);
  const [savingSecretKey, setSavingSecretKey] = useState(false);

  const [logFiles, setLogFiles] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logOffset, setLogOffset] = useState(0);
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

  const fetchAppLog = useCallback(
    async (date: string, offset?: number) => {
      setLoadingLogs(true);
      try {
        const res = await api.settings.readAppLog(date, { limit: SYSTEM_LOGS_PAGE_SIZE, offset });
        setLogLines(res.lines);
        setLogTotal(res.total);
        setLogOffset(res.offset);
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setLoadingLogs(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (!open || activeTab !== "logs" || !selectedDate) {
      setLogLines([]);
      setLogTotal(0);
      setLogOffset(0);
      return;
    }
    void fetchAppLog(selectedDate);
  }, [open, activeTab, selectedDate, fetchAppLog]);

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
    await fetchAppLog(selectedDate);
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

          <button
            type="button"
            className={cx("app-settings__nav-btn", activeTab === "about" && "app-settings__nav-btn--active")}
            onClick={() => setActiveTab("about")}
          >
            <Info size={14} />
            <span>About</span>
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
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    minLength={8}
                    autoComplete="new-password"
                    spellCheck={false}
                    trailing={
                      <IconButton
                        size="sm"
                        label={showNewPassword ? "Hide password" : "Show password"}
                        icon={showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        onClick={() => setShowNewPassword((current) => !current)}
                      />
                    }
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
                {logTotal > 0 && (
                  <span className="system-logs__hint">
                    {logOffset + 1}–{logOffset + logLines.length} of {logTotal} lines
                  </span>
                )}
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

              {logTotal > SYSTEM_LOGS_PAGE_SIZE && (
                <div className="system-logs__pager">
                  <Button
                    variant="secondary"
                    size="xs"
                    icon={<ChevronLeft size={13} />}
                    disabled={loadingLogs || logOffset === 0}
                    onClick={() => void fetchAppLog(selectedDate, Math.max(0, logOffset - SYSTEM_LOGS_PAGE_SIZE))}
                  >
                    Older
                  </Button>
                  <Button
                    variant="secondary"
                    size="xs"
                    trailingIcon={<ChevronRight size={13} />}
                    disabled={loadingLogs || logOffset + SYSTEM_LOGS_PAGE_SIZE >= logTotal}
                    onClick={() => void fetchAppLog(selectedDate, logOffset + SYSTEM_LOGS_PAGE_SIZE)}
                  >
                    Newer
                  </Button>
                </div>
              )}
            </div>
          )}

          {activeTab === "about" && (
            <div className="about-pane">
              <div className="about-pane__hero">
                <BrandMark size={64} />
                <h3 className="about-pane__title">{APP_NAME}</h3>
                <p className="about-pane__description">{APP_DESCRIPTION}</p>
                <Badge mono className="about-pane__version">
                  v{APP_VERSION}
                </Badge>
              </div>

              <section className="about-pane__group" aria-label="Application information">
                <div className="about-pane__row">
                  <div className="about-pane__label">
                    <strong>Author</strong>
                    <span>{APP_AUTHOR}</span>
                  </div>
                  <a
                    href={APP_AUTHOR_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="about-pane__link"
                    aria-label={`Open author website (${APP_AUTHOR})`}
                    title={APP_AUTHOR_URL}
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>

                <div className="about-pane__row">
                  <div className="about-pane__label">
                    <strong>GitHub</strong>
                    <span>{APP_REPO}</span>
                  </div>
                  <a
                    href={APP_REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="about-pane__link"
                    aria-label={`Open GitHub repository (${APP_REPO})`}
                    title={APP_REPO_URL}
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
