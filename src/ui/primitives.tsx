import { DialogButton } from "@decky/ui";
import type { CSSProperties, ReactNode } from "react";
import { FaCheckCircle, FaChevronRight, FaExclamationTriangle } from "react-icons/fa";

import { ACCENT, TONE_COLORS, type Tone, UI_CSS, WARNING } from "./theme";

export function UiStyles() {
  return <style>{UI_CSS}</style>;
}

// RustDesk's logo (res/logo.svg in rustdesk/rustdesk): two interlocking arcs.
const LOGO_PATH =
  "m89.318 903.552-2.135 2.122c-.376.337-.558.879-.347 1.337 1.422 2.976.882 6.524-1.452 8.856-2.335 2.331-5.887 2.87-8.866 1.449-.439-.197-.954-.03-1.292.312l-2.17 2.167a1.154 1.154 0 0 0 .208 1.81 13.005 13.005 0 0 0 15.91-1.912 12.97 12.97 0 0 0 1.956-15.887 1.154 1.154 0 0 0-1.812-.254zm-18.467-2.305a12.969 12.969 0 0 0-2.02 15.885 1.154 1.154 0 0 0 1.812.254l2.124-2.11c.385-.336.572-.884.359-1.348-1.423-2.976-.884-6.524 1.451-8.856 2.334-2.332 5.887-2.871 8.866-1.45.434.194.942.033 1.281-.3l2.182-2.18a1.152 1.152 0 0 0-.208-1.81 13.009 13.009 0 0 0-15.893 1.973z";

export function RustDeskLogo({ size = 24, color }: { size?: number; color?: string }) {
  const id = `rd-logo-${color ?? "brand"}`.replace(/[^\w-]/g, "");
  return (
    <svg viewBox="66.993 897.484 26 26" width={size} height={size} style={{ display: "block" }}>
      {color ? null : (
        <defs>
          <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0.15" stopColor="#0071ff" />
            <stop offset="0.85" stopColor="#00bfe1" />
          </linearGradient>
        </defs>
      )}
      <path fill={color ?? `url(#${id})`} d={LOGO_PATH} />
    </svg>
  );
}

/**
 * RustDesk's logo as a status beacon: gray and still when stopped, in its own colors with blue waves
 * while waiting, faster green waves while someone is connected, and spinning amber while busy.
 */
export function Beacon({ tone, size = 48 }: { tone: Tone; size?: number }) {
  const color = TONE_COLORS[tone];
  const waves = tone === "idle" || tone === "live";
  return (
    <div className={`rd-beacon ${tone}`} style={{ width: size, height: size, ["--rd-tone" as string]: color }}>
      {waves ? (
        <>
          <span className="rd-wave" />
          <span className="rd-wave" />
          <span className="rd-wave" />
        </>
      ) : null}
      <span className="rd-ring" style={{ position: "absolute", inset: "27%", display: "flex" }}>
        <RustDeskLogo size={size * 0.46} color={waves ? undefined : color} />
      </span>
    </div>
  );
}

/** Splits a code into groups of `group` counted from the right, like digits ("1 234 567 890"). */
export function groupCode(text: string, group = 3): string[] {
  const s = text.replace(/\s/g, "");
  if (group <= 0) return [s];
  const head = s.length % group;
  return [s.slice(0, head), ...(s.slice(head).match(new RegExp(`.{${group}}`, "g")) ?? [])].filter(Boolean);
}

/** A code as keycaps: an ID in threes, a password character by character (group 1) or whole (0). */
export function Keycaps({ text, group = 3, size = 18 }: { text: string; group?: number; size?: number }) {
  const parts = groupCode(text, group);
  return (
    <div className="rd-keys">
      {parts.map((part, i) => (
        <span key={i} className="rd-key" style={{ fontSize: size }}>
          {part}
        </span>
      ))}
    </div>
  );
}

export function Tag({ children, color, style }: { children: ReactNode; color?: string; style?: CSSProperties }) {
  return (
    <span className="rd-tag" style={color ? { color, background: `${color}26`, ...style } : style}>
      {children}
    </span>
  );
}

export function Dot({ color, pulse = false, size = 7 }: { color: string; pulse?: boolean; size?: number }) {
  return (
    <span
      className={pulse ? "rd-pulse" : undefined}
      style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, flex: "0 0 auto" }}
    />
  );
}

export function ActionButton({
  children,
  onClick,
  variant,
  disabled = false,
  progress,
  style,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "primary" | "danger";
  disabled?: boolean;
  /** 0..1 fills the button from the left, e.g. a download in flight. */
  progress?: number;
  style?: CSSProperties;
}) {
  return (
    <DialogButton
      className={`rd-btn rd-action${variant ? ` ${variant}` : ""}${disabled ? " disabled" : ""}`}
      noFocusRing
      onClick={() => {
        if (!disabled) onClick();
      }}
      style={style}
    >
      {progress !== undefined ? <span className="rd-action-fill" style={{ width: `${progress * 100}%` }} /> : null}
      <span style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>{children}</span>
    </DialogButton>
  );
}

export function IconButton({ children, onClick, label }: { children: ReactNode; onClick: () => void; label?: string }) {
  return (
    <DialogButton className="rd-btn rd-icon" noFocusRing onClick={onClick} aria-label={label}>
      {children}
    </DialogButton>
  );
}

export function Chip({
  label,
  selected = false,
  dimmed = false,
  onClick,
}: {
  label: ReactNode;
  selected?: boolean;
  dimmed?: boolean;
  onClick: () => void;
}) {
  return (
    <DialogButton className={`rd-btn rd-chip${selected ? " on" : ""}${dimmed ? " dim" : ""}`} noFocusRing onClick={onClick}>
      {label}
    </DialogButton>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "14px 0 8px" }}>
      <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.6px", textTransform: "uppercase", color: "#8b929a" }}>
        {children}
      </span>
      <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
      {aside}
    </div>
  );
}

export function StatTile({ label, value, color, icon }: { label: string; value: ReactNode; color?: string; icon?: ReactNode }) {
  return (
    <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.05)", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#8b929a", whiteSpace: "nowrap" }}>
        {icon}
        {label}
      </div>
      <div
        style={{
          marginTop: 2,
          fontSize: 15,
          fontWeight: 600,
          color: color ?? "#ffffff",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/** Selectable card for one-of-many settings. */
export function OptionCard({
  title,
  description,
  icon,
  badge,
  selected,
  onClick,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <DialogButton className={`rd-btn rd-option${selected ? " on" : ""}`} noFocusRing onClick={onClick}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
        {icon}
        <span style={{ flex: 1, minWidth: 0 }}>{title}</span>
        {badge}
        {selected ? <FaCheckCircle color={ACCENT} /> : null}
      </div>
      {description ? <div style={{ fontSize: 12, lineHeight: 1.4, opacity: 0.75 }}>{description}</div> : null}
    </DialogButton>
  );
}

function RowText({ label, description }: { label: ReactNode; description?: ReactNode }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 2 }}>
      <span style={{ fontSize: 14 }}>{label}</span>
      {description ? <span style={{ fontSize: 12, opacity: 0.65, lineHeight: 1.35 }}>{description}</span> : null}
    </div>
  );
}

/** A full-width row with an on/off switch; rows sit in a <div className="rd-group">. */
export function SwitchRow({
  label,
  description,
  icon,
  checked,
  disabled = false,
  onChange,
}: {
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <DialogButton
      className={`rd-btn rd-row${disabled ? " disabled" : ""}`}
      noFocusRing
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
    >
      {icon ? <span style={{ display: "flex", width: 20, justifyContent: "center" }}>{icon}</span> : null}
      <RowText label={label} description={description} />
      <span className={`rd-switch${checked ? " on" : ""}`} />
    </DialogButton>
  );
}

/** A full-width row that opens something (a dialog, a page) and shows the current value. */
export function LinkRow({
  label,
  description,
  value,
  icon,
  disabled = false,
  onClick,
}: {
  label: ReactNode;
  description?: ReactNode;
  value?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <DialogButton
      className={`rd-btn rd-row${disabled ? " disabled" : ""}`}
      noFocusRing
      onClick={() => {
        if (!disabled) onClick();
      }}
    >
      {icon ? <span style={{ display: "flex", width: 20, justifyContent: "center" }}>{icon}</span> : null}
      <RowText label={label} description={description} />
      {value !== undefined ? (
        <span style={{ fontSize: 13, opacity: 0.8, maxWidth: "45%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value}
        </span>
      ) : null}
      <FaChevronRight style={{ opacity: 0.6 }} />
    </DialogButton>
  );
}

/** Toggle drawn as a tile with a glowing icon, for grids of permissions. */
export function ToggleTile({
  label,
  state,
  icon,
  checked,
  onChange,
}: {
  label: string;
  state: string;
  icon: ReactNode;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <DialogButton
      className={`rd-btn rd-tile${checked ? " on" : ""}`}
      noFocusRing
      onClick={() => onChange(!checked)}
    >
      <span style={{ display: "flex", alignItems: "center", width: "100%" }}>
        <span className="rd-tile-icon">{icon}</span>
        <span style={{ flex: 1 }} />
        <span className={`rd-switch${checked ? " on" : ""}`} />
      </span>
      <span style={{ display: "grid", gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12, opacity: 0.75 }}>{state}</span>
      </span>
    </DialogButton>
  );
}

export function EmptyState({ icon, title, body, children }: { icon: ReactNode; title: string; body?: string; children?: ReactNode }) {
  return (
    <div
      className="rd-dots"
      style={{ display: "grid", justifyItems: "center", gap: 10, padding: "36px 20px", borderRadius: 10, textAlign: "center", color: "#8b929a" }}
    >
      {icon}
      <div style={{ fontSize: 16, fontWeight: 600, color: "#dfe3e6" }}>{title}</div>
      {body ? <div style={{ fontSize: 12, maxWidth: 380, lineHeight: 1.4 }}>{body}</div> : null}
      {children ? <div style={{ marginTop: 6, minWidth: 220 }}>{children}</div> : null}
    </div>
  );
}

/** A warning strip for a setting that needs the user's attention. */
export function Callout({ children, color = WARNING }: { children: ReactNode; color?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 8,
        fontSize: 13,
        lineHeight: 1.4,
        color: "#dfe3e6",
        background: `${color}1f`,
        boxShadow: `inset 3px 0 0 ${color}`,
      }}
    >
      <FaExclamationTriangle color={color} style={{ flex: "0 0 auto" }} />
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </div>
  );
}
