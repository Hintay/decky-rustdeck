import { Focusable } from "@decky/ui";
import { FaExternalLinkAlt, FaInfoCircle, FaKey, FaLink, FaPlug, FaPowerOff, FaServer, FaShieldAlt, FaSyncAlt, FaTv, FaUnlink } from "react-icons/fa";

import { disconnectAll, setEnabled } from "../backend";
import { usePassword } from "../hooks";
import { t } from "../i18n";
import type { PageId } from "../nav";
import { lockedOut, stateLabel, verificationLabel } from "../labels";
import { openRustDesk } from "../rustdesk-window";
import { ActionButton, Beacon, Callout, IconButton, Keycaps, LinkRow, SectionTitle, StatTile } from "../ui/primitives";
import { TONE_COLORS, WARNING, toneOf } from "../ui/theme";
import type { PageCtx } from "./context";
import { NotInstalled } from "./NotInstalled";

export function OverviewPage({ ctx, go }: { ctx: PageCtx; go: (p: PageId) => void }) {
  const { status } = ctx;
  const [password, refreshPassword] = usePassword(status);
  if (!status.installed) return <NotInstalled onDone={ctx.refreshStatus} />;

  const tone = toneOf(status);
  const color = TONE_COLORS[tone];
  const host = ctx.server["custom-rendezvous-server"];
  const composite = status.prefer_portal
    ? t("composite_not_needed")
    : status.composite
      ? t("composite_forced")
      : status.auto_composite
        ? t("composite_on_demand")
        : t("composite_off");

  const waiting = status.active && status.connections === 0 && !!status.id;
  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "104px minmax(0, 1fr)",
          alignItems: "center",
          gap: 18,
          marginTop: 8,
          padding: "14px 18px",
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.06)",
          backgroundColor: "#141b24",
          backgroundImage: `radial-gradient(circle at 70px 50%, ${color}38, transparent 190px), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`,
          backgroundSize: "auto, 14px 14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Beacon tone={tone} size={104} />
        </div>
        <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color }}>{stateLabel(status)}</div>
            <div className="rd-muted">{status.enabled ? t("autostart_on") : t("enable_hint")}</div>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <span className="rd-muted">{t("id")}</span>
            {status.id ? <Keycaps text={status.id} size={20} /> : <span style={{ color: "#5b6470", fontSize: 18 }}>— — —</span>}
          </div>
          {password?.available ? (
            <div style={{ display: "grid", gap: 4 }}>
              <span className="rd-muted">{t("temp_password")}</span>
              <Focusable flow-children="row" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {password.temporary ? (
                  <>
                    <Keycaps text={password.temporary} group={1} size={15} />
                    <IconButton label={t("refresh")} onClick={refreshPassword}>
                      <FaSyncAlt />
                    </IconButton>
                  </>
                ) : (
                  <span style={{ color: "#b8bcbf" }}>{t("temp_password_off")}</span>
                )}
              </Focusable>
            </div>
          ) : null}
        </div>
      </div>

      <Focusable flow-children="row" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 8 }}>
        <ActionButton
          variant={status.enabled ? undefined : "primary"}
          disabled={status.busy}
          onClick={async () => ctx.setStatus(await setEnabled(!status.enabled))}
        >
          <FaPowerOff />
          {status.enabled ? t("stop_service") : t("start_service")}
        </ActionButton>
        <ActionButton variant="danger" disabled={status.connections === 0} onClick={() => disconnectAll()}>
          <FaUnlink />
          {t("disconnect")}
        </ActionButton>
        <ActionButton onClick={openRustDesk}>
          <FaExternalLinkAlt />
          {t("open_rustdesk")}
        </ActionButton>
      </Focusable>

      {lockedOut(ctx.rs) ? (
        <div style={{ marginTop: 10 }}>
          <Callout>{t("locked_out")}</Callout>
        </div>
      ) : waiting ? (
        <div className="rd-muted" style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 2px 0", fontSize: 13 }}>
          <FaInfoCircle />
          {t("connect_hint")}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: 10 }}>
        <StatTile icon={<FaLink />} label={t("stat_connections")} value={status.connections} color={status.connections ? TONE_COLORS.live : undefined} />
        <StatTile icon={<FaTv />} label={t("stat_capture")} value={status.prefer_portal ? t("capture_portal_short") : t("capture_drm_short")} />
        <StatTile icon={<FaPlug />} label={t("stat_composite")} value={composite} color={status.composite ? WARNING : undefined} />
        <StatTile icon={<FaServer />} label={t("server")} value={host || t("server_public_short")} />
      </div>

      <SectionTitle>{t("section_security")}</SectionTitle>
      <div className="rd-group">
        <LinkRow
          icon={<FaShieldAlt />}
          label={t("verification_method")}
          value={verificationLabel(ctx.value("verification-method"))}
          onClick={() => go("security")}
        />
        <LinkRow
          icon={<FaKey />}
          label={t("permanent_password")}
          value={ctx.rs?.permanent_set == null ? t("unknown") : ctx.rs.permanent_set ? t("perm_set") : t("perm_not_set")}
          onClick={() => go("security")}
        />
      </div>
    </>
  );
}
