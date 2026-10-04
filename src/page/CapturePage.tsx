import { Focusable } from "@decky/ui";
import { FaLayerGroup, FaMicrochip, FaStream } from "react-icons/fa";

import { setAutoComposite, setPreferPortal } from "../backend";
import { t } from "../i18n";
import { Dot, OptionCard, SectionTitle, SwitchRow, Tag } from "../ui/primitives";
import { TONE_COLORS, WARNING } from "../ui/theme";
import type { PageCtx } from "./context";
import { NotInstalled } from "./NotInstalled";

/** Relative CPU cost as a row of bars. */
function Cost({ level }: { level: 1 | 2 | 3 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 3, height: 14 }}>
      {[1, 2, 3].map((i) => (
        <span key={i} style={{ width: 5, height: 5 + i * 3, borderRadius: 1, background: i <= level ? "currentColor" : "rgba(127,127,127,0.35)" }} />
      ))}
    </span>
  );
}

export function CapturePage({ ctx }: { ctx: PageCtx }) {
  const { status } = ctx;
  if (!status.installed) return <NotInstalled onDone={ctx.refreshStatus} />;
  const portal = status.prefer_portal;
  const choose = async (on: boolean) => {
    if (on !== portal && !status.busy) ctx.setStatus(await setPreferPortal(on));
  };

  return (
    <>
      <SectionTitle>{t("capture_method")}</SectionTitle>
      <Focusable flow-children="row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <OptionCard
          icon={<FaMicrochip />}
          title={t("capture_drm")}
          badge={<Tag color={TONE_COLORS.live}>{t("recommended")}</Tag>}
          description={
            <>
              {t("capture_drm_desc")}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                {t("cpu_cost")} <Cost level={1} />
              </div>
            </>
          }
          selected={!portal}
          onClick={() => choose(false)}
        />
        <OptionCard
          icon={<FaStream />}
          title={t("capture_portal")}
          badge={<Tag color={WARNING}>{t("experimental")}</Tag>}
          description={
            <>
              {t("prefer_portal_desc")}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                {t("cpu_cost")} <Cost level={2} />
              </div>
            </>
          }
          selected={portal}
          onClick={() => choose(true)}
        />
      </Focusable>
      {status.active ? <div className="rd-muted" style={{ marginTop: 8 }}>{t("capture_restart_note")}</div> : null}

      <SectionTitle
        aside={
          status.composite ? (
            <Tag color={WARNING}>
              <Dot color={WARNING} pulse size={6} />
              {t("composite_forced")}
            </Tag>
          ) : null
        }
      >
        {t("section_composite")}
      </SectionTitle>
      <div className="rd-group">
        <SwitchRow
          icon={<FaLayerGroup />}
          label={t("auto_composite")}
          description={portal ? t("auto_composite_portal") : t("auto_composite_desc")}
          checked={status.auto_composite && !portal}
          disabled={portal}
          onChange={async (on) => ctx.setStatus(await setAutoComposite(on))}
        />
      </div>
    </>
  );
}
