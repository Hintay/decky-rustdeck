import { Focusable, showModal } from "@decky/ui";
import { FaKey, FaListUl, FaRandom, FaUserLock } from "react-icons/fa";
import { FaShieldHalved } from "react-icons/fa6";
import type { ReactNode } from "react";

import { type Key, t } from "../i18n";
import { lockedOut } from "../labels";
import { PasswordModal, WhitelistModal } from "../modals";
import { Callout, Chip, LinkRow, OptionCard, SectionTitle } from "../ui/primitives";
import type { PageCtx } from "./context";
import { NotInstalled } from "./NotInstalled";

const METHODS: { data: string; title: Key; desc: Key; icon: ReactNode }[] = [
  { data: "use-both-passwords", title: "vm_both", desc: "vm_both_desc", icon: <FaShieldHalved /> },
  { data: "use-temporary-password", title: "vm_temp", desc: "vm_temp_desc", icon: <FaRandom /> },
  { data: "use-permanent-password", title: "vm_perm", desc: "vm_perm_desc", icon: <FaUserLock /> },
];

export function SecurityPage({ ctx }: { ctx: PageCtx }) {
  const { status, rs } = ctx;
  if (!status.installed || !rs?.available) return <NotInstalled onDone={ctx.refreshStatus} />;

  const method = ctx.value("verification-method") || "use-both-passwords";
  const length = ctx.value("temporary-password-length") || "6";
  const whitelist = ctx.value("whitelist");
  const tempUnused = method === "use-permanent-password";

  return (
    <>
      {lockedOut(rs) ? (
        <div style={{ marginTop: 10 }}>
          <Callout>{t("locked_out")}</Callout>
        </div>
      ) : null}
      <SectionTitle>{t("verification_method")}</SectionTitle>
      <Focusable flow-children="row" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {METHODS.map((m) => (
          <OptionCard
            key={m.data}
            icon={m.icon}
            title={t(m.title)}
            description={t(m.desc)}
            selected={method === m.data}
            onClick={() => ctx.setOption("verification-method", m.data)}
          />
        ))}
      </Focusable>

      <SectionTitle>{t("temp_length")}</SectionTitle>
      <Focusable flow-children="row" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {["6", "8", "10"].map((n) => (
          <Chip
            key={n}
            label={t("n_chars", { n })}
            selected={length === n}
            dimmed={tempUnused}
            onClick={() => ctx.setOption("temporary-password-length", n)}
          />
        ))}
        <span className="rd-muted" style={{ marginLeft: 8 }}>
          {tempUnused ? t("temp_length_unused") : t("temp_length_desc")}
        </span>
      </Focusable>

      <SectionTitle>{t("section_access_control")}</SectionTitle>
      <div className="rd-group">
        <LinkRow
          icon={<FaKey />}
          label={t("permanent_password")}
          description={status.active ? t("perm_desc") : t("perm_needs_service")}
          value={rs.permanent_set == null ? t("unknown") : rs.permanent_set ? t("perm_set") : t("perm_not_set")}
          disabled={!status.active}
          onClick={() => showModal(<PasswordModal onSaved={ctx.reload} />)}
        />
        <LinkRow
          icon={<FaListUl />}
          label={t("whitelist")}
          description={t("whitelist_short")}
          value={whitelist ? whitelist.split(",").join(", ") : t("whitelist_off")}
          onClick={() => showModal(<WhitelistModal current={whitelist} onSaved={() => ctx.reload()} />)}
        />
      </div>
    </>
  );
}
