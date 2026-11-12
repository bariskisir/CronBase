import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CalendarClock, Check, Clock, PauseCircle, Repeat, Terminal } from "lucide-react";
import {
  INTERVAL_UNITS,
  type IntervalUnit,
  type ProjectDetail,
  type Schedule,
  type SchedulePreview,
  type ScheduleType,
} from "../../../shared/types/api";
import { api, errorMessage } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { cx } from "../../utils/cx";
import { computeClientNextRunMs, formatCountdown, formatDateTime } from "../../utils/format";
import { Badge, Button, Modal, Select, StatusDot, TextInput, type SelectOption } from "../ui";
import "./ScheduleBar.scss";

interface ScheduleBarProps {
  project: ProjectDetail;
  onUpdated: (updated: ProjectDetail) => void;
}

const CRON_PRESETS: readonly { label: string; cron: string }[] = [
  { label: "Every minute", cron: "* * * * *" },
  { label: "Every 5m", cron: "*/5 * * * *" },
  { label: "Every 15m", cron: "*/15 * * * *" },
  { label: "Every 30m", cron: "*/30 * * * *" },
  { label: "Hourly", cron: "0 * * * *" },
  { label: "Every 6h", cron: "0 */6 * * *" },
  { label: "Daily 00:00", cron: "0 0 * * *" },
  { label: "Daily 09:00", cron: "0 9 * * *" },
  { label: "Mon 09:00", cron: "0 9 * * 1" },
];

const INTERVAL_PRESETS: readonly { label: string; value: number; unit: IntervalUnit }[] = [
  { label: "30s", value: 30, unit: "seconds" },
  { label: "1m", value: 1, unit: "minutes" },
  { label: "5m", value: 5, unit: "minutes" },
  { label: "15m", value: 15, unit: "minutes" },
  { label: "1h", value: 1, unit: "hours" },
  { label: "6h", value: 6, unit: "hours" },
  { label: "1d", value: 1, unit: "days" },
  { label: "1w", value: 1, unit: "weeks" },
];

const UNIT_OPTIONS: readonly SelectOption<IntervalUnit>[] = INTERVAL_UNITS.map((unit) => ({
  value: unit,
  label: unit.charAt(0).toUpperCase() + unit.slice(1),
}));

export function ScheduleBar({ project, onUpdated }: ScheduleBarProps) {
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);

  const currentSchedule = project.schedule.schedule;
  const [mode, setMode] = useState<ScheduleType>(currentSchedule.type);
  const [cronExpr, setCronExpr] = useState(currentSchedule.type === "cron" ? currentSchedule.cron : "0 * * * *");
  const [intervalValue, setIntervalValue] = useState<number>(
    currentSchedule.type === "interval" ? currentSchedule.intervalValue : 15,
  );
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>(
    currentSchedule.type === "interval" ? currentSchedule.intervalUnit : "minutes",
  );
  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (currentSchedule.type === "none" && !modalOpen) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [currentSchedule.type, modalOpen]);

  useEffect(() => {
    const sched = project.schedule.schedule;
    setMode(sched.type);
    if (sched.type === "cron") {
      setCronExpr(sched.cron);
    } else if (sched.type === "interval") {
      setIntervalValue(sched.intervalValue);
      setIntervalUnit(sched.intervalUnit);
    }
  }, [project.schedule.schedule, modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    if (mode === "none") {
      setPreview({ valid: true, description: "Manual execution only", nextRunAt: null, error: null });
      return;
    }

    const candidate: Schedule =
      mode === "cron"
        ? { type: "cron", cron: cronExpr }
        : { type: "interval", intervalValue: Number(intervalValue) || 1, intervalUnit };

    const handle = window.setTimeout(() => {
      api.projects
        .previewSchedule(candidate)
        .then(setPreview)
        .catch((err) => setPreview({ valid: false, description: null, nextRunAt: null, error: errorMessage(err) }));
    }, 120);

    return () => window.clearTimeout(handle);
  }, [modalOpen, mode, cronExpr, intervalValue, intervalUnit]);

  const buildCandidate = (): Schedule =>
    mode === "none"
      ? { type: "none" }
      : mode === "cron"
        ? { type: "cron", cron: cronExpr.trim() }
        : { type: "interval", intervalValue: Math.max(1, Math.floor(Number(intervalValue) || 1)), intervalUnit };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await api.projects.updateSchedule(project.id, buildCandidate());
      onUpdated(updated);
      toast.success("Schedule updated");
      setModalOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const isScheduled = currentSchedule.type !== "none";
  const badgeLabel =
    currentSchedule.type === "cron" ? "Cron" : currentSchedule.type === "interval" ? "Every X" : "No Schedule";

  const liveNextRunMs = computeClientNextRunMs(currentSchedule, project.schedule.nextRunAt, nowMs);
  const previewNextRunMs = preview?.valid ? computeClientNextRunMs(buildCandidate(), preview.nextRunAt, nowMs) : null;

  return (
    <>
      <div className="schedule-bar">
        <button
          type="button"
          className={cx("schedule-bar__trigger", !isScheduled && "schedule-bar__trigger--manual")}
          onClick={() => setModalOpen(true)}
        >
          <StatusDot status={isScheduled ? "success" : "paused"} />
          <Badge tone={isScheduled ? "accent" : "neutral"}>{badgeLabel}</Badge>
          <span className="schedule-bar__desc">{project.schedule.description}</span>
          {currentSchedule.type === "cron" && <code className="schedule-bar__expr">{currentSchedule.cron}</code>}
          {liveNextRunMs !== null && (
            <span className="schedule-bar__countdown">Next {formatCountdown(liveNextRunMs, nowMs)}</span>
          )}
        </button>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Schedule"
        icon={<CalendarClock size={15} />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="schedule-form"
              variant="primary"
              loading={saving}
              disabled={preview !== null && !preview.valid}
            >
              {saving ? "Saving…" : "Apply schedule"}
            </Button>
          </>
        }
      >
        <form id="schedule-form" className="schedule-modal" onSubmit={(event) => void handleSave(event)}>
          <div className="schedule-modes" role="radiogroup" aria-label="Schedule mode">
            <button
              type="button"
              role="radio"
              aria-checked={mode === "none"}
              className={cx("schedule-mode", mode === "none" && "schedule-mode--active")}
              onClick={() => setMode("none")}
            >
              <PauseCircle size={16} className="schedule-mode__icon" />
              <span className="schedule-mode__title">No Schedule</span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={mode === "interval"}
              className={cx("schedule-mode", mode === "interval" && "schedule-mode--active")}
              onClick={() => setMode("interval")}
            >
              <Repeat size={16} className="schedule-mode__icon" />
              <span className="schedule-mode__title">Every X</span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={mode === "cron"}
              className={cx("schedule-mode", mode === "cron" && "schedule-mode--active")}
              onClick={() => setMode("cron")}
            >
              <Terminal size={16} className="schedule-mode__icon" />
              <span className="schedule-mode__title">Cron</span>
            </button>
          </div>

          {mode === "interval" && (
            <div className="schedule-config">
              <div className="schedule-interval">
                <span className="schedule-interval__label">Run every</span>
                <TextInput
                  type="number"
                  mono
                  min={1}
                  max={1_000_000}
                  value={intervalValue}
                  onChange={(event) => setIntervalValue(Number(event.target.value))}
                  wrapperClassName="schedule-interval__value"
                  aria-label="Interval value"
                  required
                />
                <Select
                  value={intervalUnit}
                  options={UNIT_OPTIONS}
                  onChange={setIntervalUnit}
                  className="schedule-interval__unit"
                  ariaLabel="Interval unit"
                />
              </div>

              <div className="schedule-presets">
                {INTERVAL_PRESETS.map((preset) => {
                  const active = intervalValue === preset.value && intervalUnit === preset.unit;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      className={cx("preset-chip", active && "preset-chip--active")}
                      onClick={() => {
                        setIntervalValue(preset.value);
                        setIntervalUnit(preset.unit);
                      }}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {mode === "cron" && (
            <div className="schedule-config">
              <div className="schedule-cron">
                <TextInput
                  mono
                  value={cronExpr}
                  onChange={(event) => setCronExpr(event.target.value)}
                  placeholder="0 * * * *"
                  aria-label="Cron expression"
                  required
                />
                <div className="schedule-cron__legend" aria-hidden="true">
                  <span>minute</span>
                  <span>hour</span>
                  <span>day (month)</span>
                  <span>month</span>
                  <span>day (week)</span>
                </div>
              </div>

              <div className="schedule-presets">
                {CRON_PRESETS.map((preset) => (
                  <button
                    key={preset.cron}
                    type="button"
                    className={cx("preset-chip", cronExpr.trim() === preset.cron && "preset-chip--active")}
                    onClick={() => setCronExpr(preset.cron)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {preview && (
            <div
              className={cx(
                "schedule-preview",
                !preview.valid
                  ? "schedule-preview--error"
                  : mode === "none"
                    ? "schedule-preview--neutral"
                    : "schedule-preview--valid",
              )}
            >
              {preview.valid ? (
                <>
                  <div className="schedule-preview__row">
                    {mode === "none" ? <Clock size={14} /> : <Check size={14} />}
                    <strong>{preview.description}</strong>
                  </div>
                  {previewNextRunMs !== null && (
                    <p className="schedule-preview__meta">
                      Next run: {formatDateTime(new Date(previewNextRunMs).toISOString())} (
                      {formatCountdown(previewNextRunMs, nowMs)})
                    </p>
                  )}
                </>
              ) : (
                <div className="schedule-preview__row">
                  <AlertCircle size={14} />
                  <span>{preview.error}</span>
                </div>
              )}
            </div>
          )}
        </form>
      </Modal>
    </>
  );
}
