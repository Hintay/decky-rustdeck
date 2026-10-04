import { DialogButton, Focusable, GamepadButton, type GamepadEvent } from "@decky/ui";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { FaInfoCircle, FaNetworkWired, FaShieldAlt, FaSlidersH, FaTachometerAlt, FaTv } from "react-icons/fa";

import { type RustdeskSettings, type Server, getRustdeskSettings, getServer, setRustdeskOption } from "../backend";
import { useCachedState, usePolledStatus } from "../hooks";
import { type Key, t } from "../i18n";
import { stateLabel } from "../labels";
import { NAV_EVENT, PAGES, type PageId, getPendingPage } from "../nav";
import { toast } from "../toast";
import { Beacon, UiStyles, groupCode } from "../ui/primitives";
import { TONE_COLORS, toneOf } from "../ui/theme";
import { useFocusRecovery } from "../ui/useFocusRecovery";
import { useScrollEdgesOnFocus } from "../ui/useScrollEdgesOnFocus";
import { AboutPage } from "./AboutPage";
import { CapturePage } from "./CapturePage";
import type { PageCtx } from "./context";
import { NetworkPage } from "./NetworkPage";
import { OverviewPage } from "./OverviewPage";
import { PermissionsPage } from "./PermissionsPage";
import { SecurityPage } from "./SecurityPage";

const NAV: Record<PageId, { icon: ReactNode; label: Key; desc: Key }> = {
  overview: { icon: <FaTachometerAlt />, label: "nav_overview", desc: "desc_overview" },
  security: { icon: <FaShieldAlt />, label: "nav_security", desc: "desc_security" },
  permissions: { icon: <FaSlidersH />, label: "nav_permissions", desc: "desc_permissions" },
  network: { icon: <FaNetworkWired />, label: "nav_network", desc: "desc_network" },
  capture: { icon: <FaTv />, label: "nav_capture", desc: "desc_capture" },
  about: { icon: <FaInfoCircle />, label: "nav_about", desc: "desc_about" },
};

function NavItem({
  page,
  active,
  onClick,
  buttonRef,
}: {
  page: PageId;
  active: boolean;
  onClick: () => void;
  buttonRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <DialogButton ref={buttonRef} className={`rd-btn rd-nav${active ? " on" : ""}`} noFocusRing onClick={onClick}>
      <span style={{ display: "flex", width: 18, justifyContent: "center" }}>{NAV[page].icon}</span>
      <span style={{ flex: 1 }}>{t(NAV[page].label)}</span>
    </DialogButton>
  );
}

function usePageCtx(): PageCtx | null {
  const [status, refreshStatus, setStatus] = usePolledStatus();
  const [rs, setRs] = useCachedState<RustdeskSettings | null>("rs", null);
  const [server, setServer] = useCachedState<Server>("server", {});

  const reload = async () => {
    setRs(await getRustdeskSettings());
    setServer(await getServer());
  };
  // Options are read once, and again when RustDesk gets (re)installed or its service comes up.
  useEffect(() => {
    reload();
  }, [status?.installed, status?.active]);

  if (!status) return null;
  const offByDefault = rs?.off_by_default ?? [];
  const value = (name: string) => rs?.values?.[name] ?? "";
  const setOption = async (name: string, v: string) => {
    const res = await setRustdeskOption(name, v);
    if (!res.ok) toast(t("option_failed"));
    setRs((prev) => (prev ? { ...prev, values: { ...prev.values, [name]: res.value ?? v } } : prev));
  };
  return {
    status,
    setStatus,
    refreshStatus,
    rs,
    server,
    setServer,
    reload,
    value,
    isOn: (name) => (offByDefault.includes(name) ? value(name) === "Y" : value(name) !== "N"),
    setOption,
    // Same encoding RustDesk's own UI writes: the default is stored as an empty value.
    setBool: (name, on) => setOption(name, offByDefault.includes(name) ? (on ? "Y" : "") : on ? "" : "N"),
  };
}

export function RustDeckPage() {
  const [page, setPage] = useState<PageId>(getPendingPage());
  const ctx = usePageCtx();
  const rootRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const navRefs = useRef<Partial<Record<PageId, HTMLDivElement | null>>>({});
  useFocusRecovery(rootRef);
  useScrollEdgesOnFocus(contentRef);

  useEffect(() => {
    const onNavigate = (e: Event) => setPage((e as CustomEvent<PageId>).detail);
    window.addEventListener(NAV_EVENT, onNavigate);
    return () => window.removeEventListener(NAV_EVENT, onNavigate);
  }, []);
  // Braced: newer Chromium returns a Promise from scrollTo, which must not become the cleanup.
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [page]);

  // L1/R1 cycle through the pages, as they do between tabs elsewhere in Steam.
  const onButtonDown = (evt: GamepadEvent) => {
    const b = evt.detail.button;
    const step = b === GamepadButton.BUMPER_LEFT ? -1 : b === GamepadButton.BUMPER_RIGHT ? 1 : 0;
    if (!step) return;
    const next = PAGES[(PAGES.indexOf(page) + step + PAGES.length) % PAGES.length];
    // With focus in the sidebar, focus follows the switch so the old item doesn't keep the focus style.
    const sidebar = sidebarRef.current;
    const inSidebar = !!sidebar && sidebar.contains(sidebar.ownerDocument.activeElement);
    setPage(next);
    if (inSidebar) window.setTimeout(() => navRefs.current[next]?.focus(), 0);
  };

  const tone = toneOf(ctx?.status ?? null);
  return (
    // Top and bottom padding clear the gamepad system bar and the footer hint bar drawn over the route.
    <Focusable
      ref={rootRef}
      flow-children="row"
      onButtonDown={onButtonDown}
      style={{ height: "100%", boxSizing: "border-box", padding: "40px 0", display: "flex", background: "#0e141b" }}
    >
      <UiStyles />
      <Focusable
        ref={sidebarRef}
        flow-children="column"
        style={{
          width: 186,
          flex: "0 0 186px",
          boxSizing: "border-box",
          padding: "14px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          background: "linear-gradient(180deg, #17202b, #10161e)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px 12px", color: "#ffffff" }}>
          <span style={{ display: "flex", borderRadius: 10, overflow: "hidden", background: "rgba(26,159,255,0.14)" }}>
            <Beacon tone={tone} size={34} />
          </span>
          <span style={{ display: "grid", minWidth: 0, overflow: "hidden" }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>RustDeck</span>
            <span className="rd-muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
              {t("tagline")}
            </span>
          </span>
        </div>
        {PAGES.map((p) => (
          <NavItem
            key={p}
            page={p}
            active={page === p}
            onClick={() => setPage(p)}
            buttonRef={(el) => {
              navRefs.current[p] = el;
            }}
          />
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.04)", display: "grid", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: TONE_COLORS[tone] }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: TONE_COLORS[tone] }} />
            {stateLabel(ctx?.status ?? null)}
          </div>
          {ctx?.status.id ? (
            <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600, letterSpacing: 1, color: "#ffffff" }}>
              {groupCode(ctx.status.id).join(" ")}
            </span>
          ) : null}
        </div>
        <div className="rd-muted" style={{ padding: "8px 8px 0", fontSize: 11 }}>
          {t("bumper_hint")}
        </div>
      </Focusable>
      <Focusable
        ref={contentRef}
        flow-children="column"
        style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "12px 18px 24px", boxSizing: "border-box" }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, color: "#ffffff" }}>{t(NAV[page].label)}</div>
        <div className="rd-muted" style={{ fontSize: 12, marginBottom: 2 }}>
          {t(NAV[page].desc)}
        </div>
        {ctx ? <PageBody page={page} ctx={ctx} go={setPage} /> : null}
      </Focusable>
    </Focusable>
  );
}

function PageBody({ page, ctx, go }: { page: PageId; ctx: PageCtx; go: (p: PageId) => void }) {
  switch (page) {
    case "overview":
      return <OverviewPage ctx={ctx} go={go} />;
    case "security":
      return <SecurityPage ctx={ctx} />;
    case "permissions":
      return <PermissionsPage ctx={ctx} />;
    case "network":
      return <NetworkPage ctx={ctx} />;
    case "capture":
      return <CapturePage ctx={ctx} />;
    case "about":
      return <AboutPage ctx={ctx} />;
  }
}
