import { Focusable, showModal } from "@decky/ui";
import { FaBroadcastTower, FaEthernet, FaFileImport, FaGlobe, FaUndo, FaWifi } from "react-icons/fa";

import { clearServer, getServer } from "../backend";
import { t } from "../i18n";
import { ServerConfigModal } from "../modals";
import { ActionButton, SectionTitle, SwitchRow, Tag } from "../ui/primitives";
import { ACCENT } from "../ui/theme";
import type { PageCtx } from "./context";
import { NotInstalled } from "./NotInstalled";

function ServerLine({ label, value }: { label: string; value?: string }) {
  return (
    <>
      <span className="rd-muted" style={{ fontSize: 13 }}>
        {label}
      </span>
      <span style={{ fontFamily: "monospace", fontSize: 13, color: value ? "#dfe3e6" : "#5b6470", overflowWrap: "anywhere" }}>
        {value || t("server_auto")}
      </span>
    </>
  );
}

export function NetworkPage({ ctx }: { ctx: PageCtx }) {
  if (!ctx.status.installed || !ctx.rs?.available) return <NotInstalled onDone={ctx.refreshStatus} />;
  const s = ctx.server;
  const custom = !!s["custom-rendezvous-server"];

  return (
    <>
      <SectionTitle>{t("server")}</SectionTitle>
      <div
        style={{
          display: "grid",
          gap: 12,
          padding: "16px 18px",
          borderRadius: 10,
          background: custom ? "linear-gradient(135deg, rgba(26,159,255,0.14), rgba(255,255,255,0.03))" : "rgba(255,255,255,0.04)",
          border: `1px solid ${custom ? "rgba(26,159,255,0.35)" : "rgba(255,255,255,0.06)"}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {custom ? <FaBroadcastTower color={ACCENT} size={20} /> : <FaGlobe color="#8b929a" size={20} />}
          <span style={{ fontSize: 16, fontWeight: 600, color: "#ffffff", flex: 1, minWidth: 0 }}>
            {custom ? s["custom-rendezvous-server"] : t("server_default")}
          </span>
          {custom ? <Tag color={ACCENT}>{t("server_custom")}</Tag> : <Tag>{t("server_public_short")}</Tag>}
        </div>
        {custom ? (
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 16, rowGap: 6 }}>
            <ServerLine label={t("relay_server")} value={s["relay-server"]} />
            <ServerLine label={t("api_server")} value={s["api-server"]} />
            <ServerLine label={t("server_key")} value={s.key ? t("key_set") : undefined} />
          </div>
        ) : (
          <div className="rd-muted">{t("server_public_desc")}</div>
        )}
      </div>
      <Focusable flow-children="row" style={{ display: "grid", gridTemplateColumns: custom ? "1fr 1fr" : "1fr", gap: 8, marginTop: 10 }}>
        <ActionButton variant="primary" onClick={() => showModal(<ServerConfigModal onApplied={() => getServer().then(ctx.setServer)} />)}>
          <FaFileImport />
          {t("server_config")}
        </ActionButton>
        {custom ? (
          <ActionButton onClick={async () => ctx.setServer(await clearServer())}>
            <FaUndo />
            {t("clear_server")}
          </ActionButton>
        ) : null}
      </Focusable>

      <SectionTitle>{t("section_lan")}</SectionTitle>
      <div className="rd-group">
        <SwitchRow
          icon={<FaWifi />}
          label={t("lan_discovery")}
          description={t("lan_discovery_desc")}
          checked={ctx.isOn("enable-lan-discovery")}
          onChange={(on) => ctx.setBool("enable-lan-discovery", on)}
        />
        <SwitchRow
          icon={<FaEthernet />}
          label={t("direct_ip")}
          description={t("direct_ip_desc")}
          checked={ctx.isOn("direct-server")}
          onChange={(on) => ctx.setBool("direct-server", on)}
        />
      </div>
    </>
  );
}
