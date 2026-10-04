import { DialogButton, Focusable, PanelSection, PanelSectionRow } from "@decky/ui";
import { useRef } from "react";
import { FaChevronRight, FaPowerOff, FaSyncAlt, FaUnlink } from "react-icons/fa";

import { disconnectAll, setEnabled } from "./backend";
import { usePassword, usePolledStatus } from "./hooks";
import { t } from "./i18n";
import { stateLabel, verificationLabel } from "./labels";
import { openPage } from "./nav";
import { InstallAction } from "./page/NotInstalled";
import { ActionButton, Beacon, Callout, IconButton, Keycaps, Tag, UiStyles } from "./ui/primitives";
import { TONE_COLORS, toneOf } from "./ui/theme";
import { useFocusRecovery } from "./ui/useFocusRecovery";

export function QuickAccessPanel() {
  const [status, refresh, setStatus] = usePolledStatus();
  const [password, refreshPassword] = usePassword(status);
  const rootRef = useRef<HTMLDivElement>(null);
  useFocusRecovery(rootRef);
  if (!status) return null;

  const tone = toneOf(status);
  const color = TONE_COLORS[tone];

  return (
    <div ref={rootRef}>
      <PanelSection>
        <UiStyles />
        <PanelSectionRow>
          <div
            style={{
              position: "relative",
              display: "grid",
              gap: 12,
              padding: 14,
              borderRadius: 10,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.06)",
              backgroundColor: "#141b24",
              backgroundImage: `radial-gradient(circle at 34px 34px, ${color}40, transparent 150px), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`,
              backgroundSize: "auto, 12px 12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Beacon tone={tone} size={44} />
              <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color }}>
                  {stateLabel(status)}
                </span>
                {status.installed ? <span className="rd-muted">{status.enabled ? t("autostart_on") : t("enable_hint")}</span> : null}
              </div>
            </div>
            {status.installed && status.id ? (
              <div style={{ display: "grid", gap: 5 }}>
                <span className="rd-muted">{t("id")}</span>
                <Keycaps text={status.id} size={17} />
              </div>
            ) : null}
            {status.active && password?.available ? (
              <div style={{ display: "grid", gap: 5 }}>
                <span className="rd-muted">{t("temp_password")}</span>
                {password.temporary ? (
                  <Focusable flow-children="row" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Keycaps text={password.temporary} group={0} size={17} />
                    </div>
                    <IconButton label={t("refresh")} onClick={refreshPassword}>
                      <FaSyncAlt />
                    </IconButton>
                  </Focusable>
                ) : (
                  <span style={{ fontSize: 12, color: "#b8bcbf" }}>{t("temp_password_off")}</span>
                )}
              </div>
            ) : null}
          </div>
        </PanelSectionRow>

        <PanelSectionRow>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            {!status.installed ? (
              <InstallAction label={t("install")} onDone={refresh} />
            ) : (
              <ActionButton
                variant={status.enabled ? undefined : "primary"}
                disabled={status.busy}
                onClick={async () => setStatus(await setEnabled(!status.enabled))}
              >
                <FaPowerOff />
                {status.enabled ? t("stop_service") : t("start_service")}
              </ActionButton>
            )}
            {password?.method === "use-permanent-password" && password.permanent_set === false ? (
              <Callout>{t("locked_out_short")}</Callout>
            ) : null}
            {status.connections > 0 ? (
              <ActionButton variant="danger" onClick={() => disconnectAll()}>
                <FaUnlink />
                {t("disconnect")}
              </ActionButton>
            ) : null}
          </div>
        </PanelSectionRow>

        <PanelSectionRow>
          <DialogButton
            className="rd-btn rd-row"
            noFocusRing
            onClick={() => openPage()}
            style={{ marginTop: 10, borderRadius: 8, minHeight: 48 }}
          >
            <div style={{ display: "grid", gap: 4, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13 }}>{t("more_settings")}</span>
              {status.installed ? (
                <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <Tag>{status.installed}</Tag>
                  {password?.method ? <Tag>{verificationLabel(password.method)}</Tag> : null}
                </span>
              ) : null}
            </div>
            <FaChevronRight style={{ opacity: 0.6 }} />
          </DialogButton>
        </PanelSectionRow>
      </PanelSection>
    </div>
  );
}
