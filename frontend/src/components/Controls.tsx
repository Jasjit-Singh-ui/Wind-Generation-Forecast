import { useId, useRef, useState } from "react";
import type { DecisionPreset } from "../api/types";
import { addDays, calendarDate } from "../lib/format";

const shortDate = (ymd: string) => {
  const [year, , day] = ymd.split("-");
  const monthName = calendarDate(ymd, "short").split(" ")[1];
  return `${day} ${monthName} ${year}`;
};

const Chevron = ({ flip }: { flip?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d={flip ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} />
  </svg>
);

const CalendarIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

/** Previous / next buttons around a date button that opens the native date picker. */
export function DateStepper({ value, min, max, onChange }: { value: string; min: string; max: string; onChange: (date: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const clamp = (date: string) => (date < min ? min : date > max ? max : date);
  const openPicker = () => {
    const element = input.current;
    if (!element) return;
    try {
      element.showPicker();
    } catch {
      element.focus(); // older browsers: fall back to keyboard entry
    }
  };
  return (
    <div className="date-stepper">
      <button
        type="button"
        className="icon-btn"
        aria-label="Previous delivery day"
        title="Previous day (←)"
        disabled={value <= min}
        onClick={() => onChange(clamp(addDays(value, -1)))}
      >
        <Chevron />
      </button>
      <div className="date-field-wrap">
        <button type="button" className="date-field" onClick={openPicker} aria-label={`Delivery day ${calendarDate(value, "long")}. Change date`}>
          <CalendarIcon />
          <span>{shortDate(value)}</span>
        </button>
        <input
          ref={input}
          className="date-input"
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          min={min}
          max={max}
          value={value}
          onChange={(event) => event.target.value && onChange(clamp(event.target.value))}
        />
      </div>
      <button
        type="button"
        className="icon-btn"
        aria-label="Next delivery day"
        title="Next day (→)"
        disabled={value >= max}
        onClick={() => onChange(clamp(addDays(value, 1)))}
      >
        <Chevron flip />
      </button>
    </div>
  );
}

const presetName = (preset: DecisionPreset) =>
  preset.label.replace(" GB day-ahead (hourly)", " · hourly").replace(" GB day-ahead (half-hourly)", " · half-hourly");

/** Auction gate-closure presets plus a custom time, as one tile group. */
export function DecisionTimePicker({ presets, value, onChange }: { presets: DecisionPreset[]; value: string; onChange: (time: string) => void }) {
  const labelId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const isPreset = presets.some((preset) => preset.time === value);

  const commit = () => {
    if (draft && /^\d{2}:\d{2}$/.test(draft) && draft !== value) onChange(draft);
    setDraft(null);
  };

  return (
    <div className="control">
      <span className="control-label" id={labelId}>
        Decision time, day before delivery (UK)
      </span>
      <div className="pill-group preset-grid" role="group" aria-labelledby={labelId}>
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="pill preset"
            aria-pressed={preset.time === value}
            title={preset.description}
            onClick={() => onChange(preset.time)}
          >
            <span className="preset-time">{preset.time}</span>
            <span className="preset-name">{presetName(preset)}</span>
          </button>
        ))}
        <label className={`pill preset${isPreset ? "" : " is-active"}`} title="Any other decision time">
          <input
            type="time"
            step={60}
            aria-label="Custom decision time"
            value={draft ?? (isPreset ? "" : value)}
            placeholder="--:--"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => event.key === "Enter" && commit()}
          />
          <span className="preset-name">Custom</span>
        </label>
      </div>
    </div>
  );
}

/** Width of the uncertainty range: 80% (P10-P90) or 90% (P5-P95). */
export function CoveragePicker({ options, value, onChange }: { options: number[]; value: number; onChange: (coverage: number) => void }) {
  return (
    <div className="pill-group" role="group" aria-label="Uncertainty range">
      {options.map((option) => {
        const tail = (100 - option) / 2;
        return (
          <button key={option} type="button" className="pill mono" aria-pressed={option === value} onClick={() => onChange(option)}>
            {option}% P{tail}–P{100 - tail}
          </button>
        );
      })}
    </div>
  );
}
