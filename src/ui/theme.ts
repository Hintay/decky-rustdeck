import type { Status } from "../backend";

export const ACCENT = "#1a9fff";
export const WARNING = "#f0a63a";
export const DANGER = "#e05a5a";

// What the service is doing, as one word the UI keys colors and motion off.
export type Tone = "off" | "idle" | "live" | "busy";

export const TONE_COLORS: Record<Tone, string> = {
  off: "#5b6470",
  idle: ACCENT,
  live: "#5cba47",
  busy: WARNING,
};

export function toneOf(status: Status | null): Tone {
  if (!status || status.busy) return "busy";
  if (!status.active) return "off";
  return status.connections > 0 ? "live" : "idle";
}

// Injected once per surface. Steam marks the gamepad-focused element with "gpfocus", which is
// what the focus styles key off; :hover covers mouse and touch. Rules override DialogButton's
// built-in look, hence the doubled class selectors and !important on visual properties (Steam's
// own "DialogButton:enabled" text color otherwise wins).
export const UI_CSS = `
.rd-btn.rd-btn { min-width: 0 !important; width: auto; padding: 0 !important; margin: 0; background: transparent !important; border: none !important; box-shadow: none; text-align: left; color: inherit !important; line-height: normal; }

.rd-nav.rd-nav { display: flex; align-items: center; gap: 10px; width: 100%; height: 40px; padding: 0 12px !important; border-radius: 6px; font-size: 14px; color: #b8bcbf !important; }
.rd-nav.rd-nav.on { color: #ffffff !important; background: rgba(255,255,255,0.08) !important; box-shadow: inset 3px 0 0 ${ACCENT}; }
.rd-nav.rd-nav.gpfocus, .rd-nav.rd-nav:hover { color: #0e141b !important; background: #ffffff !important; box-shadow: none; }

.rd-action.rd-action { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; padding: 0 14px !important; border-radius: 6px; font-size: 14px; color: #dfe3e6 !important; background: rgba(255,255,255,0.08) !important; text-align: center; position: relative; overflow: hidden; }
.rd-action.rd-action.primary { color: #ffffff !important; background: ${ACCENT} !important; }
.rd-action.rd-action.danger { color: #ff8f8f !important; }
.rd-action.rd-action.gpfocus, .rd-action.rd-action:hover { color: #0e141b !important; background: #ffffff !important; }
.rd-action.rd-action.disabled { opacity: 0.45; }
.rd-action-fill { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(255,255,255,0.18); transition: width 250ms ease; }

.rd-chip.rd-chip { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0 14px !important; border-radius: 16px; font-size: 13px; color: #c7d0d9 !important; background: rgba(255,255,255,0.06) !important; border: 1px solid rgba(255,255,255,0.12) !important; white-space: nowrap; }
.rd-chip.rd-chip.on { color: #ffffff !important; background: rgba(26,159,255,0.22) !important; border-color: ${ACCENT} !important; }
.rd-chip.rd-chip.dim { opacity: 0.4; }
.rd-chip.rd-chip.gpfocus, .rd-chip.rd-chip:hover { color: #0e141b !important; background: #ffffff !important; border-color: #ffffff !important; }

.rd-option.rd-option { display: grid; align-content: start; gap: 6px; width: 100%; height: 100%; padding: 14px !important; border-radius: 8px; text-align: left; color: #dfe3e6 !important; background: rgba(255,255,255,0.05) !important; border: 1px solid rgba(255,255,255,0.08) !important; }
.rd-option.rd-option.on { background: rgba(26,159,255,0.14) !important; border-color: ${ACCENT} !important; }
.rd-option.rd-option.gpfocus, .rd-option.rd-option:hover { color: #0e141b !important; background: #ffffff !important; border-color: #ffffff !important; }

.rd-row.rd-row { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 56px; padding: 10px 14px !important; color: #dfe3e6 !important; background: rgba(255,255,255,0.04) !important; border-radius: 0; }
.rd-row.rd-row.disabled { opacity: 0.5; }
.rd-row.rd-row.gpfocus, .rd-row.rd-row:hover { color: #0e141b !important; background: #ffffff !important; }
.rd-group { display: grid; gap: 1px; border-radius: 8px; overflow: hidden; }

.rd-tile.rd-tile { display: grid; justify-items: start; gap: 10px; width: 100%; padding: 14px !important; border-radius: 10px; color: #8b929a !important; background: rgba(255,255,255,0.04) !important; border: 1px solid rgba(255,255,255,0.06) !important; transition: transform 120ms ease; }
.rd-tile.rd-tile.on { color: #dfe3e6 !important; background: linear-gradient(160deg, rgba(26,159,255,0.20), rgba(26,159,255,0.05)) !important; border-color: rgba(26,159,255,0.55) !important; }
.rd-tile.rd-tile.gpfocus, .rd-tile.rd-tile:hover { color: #0e141b !important; background: #ffffff !important; border-color: #ffffff !important; transform: scale(1.03); }
.rd-tile-icon { display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 50%; font-size: 17px; background: rgba(255,255,255,0.06); }
.rd-tile.on .rd-tile-icon { color: #ffffff; background: ${ACCENT}; box-shadow: 0 0 16px rgba(26,159,255,0.55); }

.rd-icon.rd-icon { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; min-width: 34px !important; padding: 0 !important; border-radius: 6px; color: #b8bcbf !important; background: rgba(255,255,255,0.06) !important; }
.rd-icon.rd-icon.gpfocus, .rd-icon.rd-icon:hover { color: #0e141b !important; background: #ffffff !important; }

.rd-switch { position: relative; flex: 0 0 auto; width: 40px; height: 22px; border-radius: 11px; background: rgba(255,255,255,0.16); transition: background 150ms ease; }
.rd-switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #dfe3e6; transition: transform 150ms ease; }
.rd-switch.on { background: ${ACCENT}; }
.rd-switch.on::after { transform: translateX(18px); background: #ffffff; }
.gpfocus .rd-switch:not(.on), .rd-btn:hover .rd-switch:not(.on) { background: #c3c8ce; }

.rd-keys { display: flex; flex-wrap: wrap; gap: 6px; }
.rd-key { padding: 3px 8px 2px; border-radius: 6px; font-family: monospace; font-weight: 600; letter-spacing: 1px; color: #ffffff; background: rgba(255,255,255,0.08); box-shadow: inset 0 -2px 0 rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.06); }

.rd-tag { display: inline-flex; align-items: center; gap: 5px; height: 20px; padding: 0 7px; border-radius: 4px; font-size: 11px; line-height: 20px; color: #c7d0d9; background: rgba(255,255,255,0.09); white-space: nowrap; }
.rd-muted { color: #8b929a; font-size: 12px; }
.rd-dots { background-image: radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px); background-size: 14px 14px; }

.rd-beacon { position: relative; flex: 0 0 auto; }
.rd-wave { position: absolute; inset: 0; border-radius: 50%; border: 2px solid var(--rd-tone); pointer-events: none; opacity: 0; animation: rd-wave 2.7s ease-out infinite; }
.rd-wave:nth-child(2) { animation-delay: 0.9s; }
.rd-wave:nth-child(3) { animation-delay: 1.8s; }
.rd-beacon.live .rd-wave { animation-duration: 1.6s; }
.rd-beacon.live .rd-wave:nth-child(2) { animation-delay: 0.53s; }
.rd-beacon.live .rd-wave:nth-child(3) { animation-delay: 1.06s; }
@keyframes rd-wave { 0% { transform: scale(0.45); opacity: 0.9; } 100% { transform: scale(1.45); opacity: 0; } }
.rd-beacon.busy .rd-ring { animation: rd-spin 1.2s linear infinite; }
@keyframes rd-spin { to { transform: rotate(360deg); } }
.rd-spin { animation: rd-spin 1s linear infinite; }
@keyframes rd-pulse { 50% { opacity: 0.4; } }
.rd-pulse { animation: rd-pulse 1.4s ease-in-out infinite; }
`;
