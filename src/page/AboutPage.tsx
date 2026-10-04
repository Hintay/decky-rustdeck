import { ConfirmModal, Focusable, showModal } from "@decky/ui";
import { useEffect, useState } from "react";
import { FaArrowRight, FaCheckCircle, FaExternalLinkAlt, FaSearch, FaSyncAlt, FaTrashAlt } from "react-icons/fa";

import { type UpdateInfo, checkUpdate, uninstallRustdesk } from "../backend";
import { t } from "../i18n";
import { openRustDesk } from "../rustdesk-window";
import { ActionButton, Beacon, SectionTitle, Tag } from "../ui/primitives";
import { TONE_COLORS, toneOf } from "../ui/theme";
import type { PageCtx } from "./context";
import { InstallAction, NotInstalled } from "./NotInstalled";

const SOURCE = "github.com/Hintay/rustdesk";

export function AboutPage({ ctx }: { ctx: PageCtx }) {
  const { status } = ctx;
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const check = async () => {
    setChecking(true);
    setUpdate(await checkUpdate());
    setChecking(false);
  };
  // One release lookup per visit; GitHub allows 60 unauthenticated requests an hour.
  useEffect(() => {
    if (status.installed) check();
  }, [status.installed]);
  if (!status.installed) return <NotInstalled onDone={ctx.refreshStatus} />;

  const latest = update?.latest?.tag;
  const newer = !!latest && latest !== status.installed;

  return (
    <>
      <div
        className="rd-dots"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          marginTop: 10,
          padding: "18px 20px",
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <Beacon tone={toneOf(status)} size={72} />
        <div style={{ display: "grid", gap: 6, flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#ffffff" }}>RustDesk</span>
            {newer ? null : <Tag>{status.installed}</Tag>}
          </div>
          <div className="rd-muted">
            {t("source")}: {SOURCE}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            {checking ? (
              <span className="rd-muted">
                <FaSyncAlt className="rd-spin" size={11} /> {t("checking")}
              </span>
            ) : update?.error ? (
              <span style={{ color: "#ff8f8f" }}>{`${t("check_failed")}: ${update.error}`}</span>
            ) : newer ? (
              <>
                <Tag>{status.installed}</Tag>
                <FaArrowRight color={TONE_COLORS.idle} size={11} />
                <Tag color={TONE_COLORS.idle}>{latest}</Tag>
              </>
            ) : update ? (
              <span style={{ color: TONE_COLORS.live, display: "flex", alignItems: "center", gap: 6 }}>
                <FaCheckCircle /> {t("up_to_date")}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <Focusable flow-children="row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        {newer ? (
          <InstallAction label={t("update_to", { tag: latest ?? "" })} onDone={ctx.refreshStatus} />
        ) : (
          <ActionButton disabled={checking} onClick={check}>
            {checking ? <FaSyncAlt className="rd-spin" /> : update && !update.error ? <FaCheckCircle /> : <FaSearch />}
            {t("check_update")}
          </ActionButton>
        )}
        <ActionButton onClick={openRustDesk}>
          <FaExternalLinkAlt />
          {t("open_rustdesk")}
        </ActionButton>
      </Focusable>
      <div className="rd-muted" style={{ marginTop: 8 }}>
        {t("open_rustdesk_desc")}
      </div>

      <SectionTitle>{t("section_danger")}</SectionTitle>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 8, border: "1px solid rgba(224,90,90,0.3)" }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: "#b8bcbf", lineHeight: 1.4 }}>{t("uninstall_desc")}</div>
        <ActionButton
          variant="danger"
          disabled={status.busy}
          onClick={() =>
            showModal(
              <ConfirmModal
                strTitle={t("uninstall")}
                strDescription={t("uninstall_confirm")}
                bDestructiveWarning
                onOK={async () => {
                  ctx.setStatus(await uninstallRustdesk());
                }}
              />,
            )
          }
        >
          <FaTrashAlt />
          {t("uninstall")}
        </ActionButton>
      </div>
    </>
  );
}
