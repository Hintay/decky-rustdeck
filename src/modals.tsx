import { ConfirmModal, TextField } from "@decky/ui";
import { useState } from "react";

import { applyServerConfig, setPermanentPassword, setRustdeskOption } from "./backend";
import { t } from "./i18n";
import { toast } from "./toast";

export function ServerConfigModal({ closeModal, onApplied }: { closeModal?: () => void; onApplied: () => void }) {
  const [text, setText] = useState("");
  return (
    <ConfirmModal
      strTitle={t("server_config_title")}
      strDescription={t("server_config_desc")}
      strOKButtonText={t("apply")}
      bOKDisabled={!text.trim()}
      closeModal={closeModal}
      onOK={async () => {
        const res = await applyServerConfig(text);
        toast(res.ok ? t("server_applied") : t("server_failed"));
        onApplied();
      }}
    >
      <TextField value={text} onChange={(e) => setText(e.target.value)} />
    </ConfirmModal>
  );
}

export function PasswordModal({ closeModal, onSaved }: { closeModal?: () => void; onSaved: () => void }) {
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const problem =
    first.length > 0 && first.length < 6
      ? t("perm_too_short")
      : second.length > 0 && first !== second
        ? t("perm_mismatch")
        : null;
  return (
    <ConfirmModal
      strTitle={t("perm_title")}
      strOKButtonText={t("set")}
      bOKDisabled={first.length < 6 || first !== second}
      closeModal={closeModal}
      onOK={async () => {
        const res = await setPermanentPassword(first);
        toast(res.ok ? t("perm_saved") : res.error === "service not running" ? t("perm_needs_service") : t("perm_failed"));
        onSaved();
      }}
    >
      <TextField label={t("perm_new")} bIsPassword value={first} onChange={(e) => setFirst(e.target.value)} />
      <TextField label={t("perm_confirm")} bIsPassword value={second} onChange={(e) => setSecond(e.target.value)} />
      {problem && <div style={{ color: "#ff6b6b", marginTop: "8px" }}>{problem}</div>}
    </ConfirmModal>
  );
}

export function WhitelistModal({
  closeModal,
  current,
  onSaved,
}: {
  closeModal?: () => void;
  current: string;
  onSaved: (value: string) => void;
}) {
  const [text, setText] = useState(current);
  return (
    <ConfirmModal
      strTitle={t("whitelist")}
      strDescription={t("whitelist_desc")}
      strOKButtonText={t("apply")}
      closeModal={closeModal}
      onOK={async () => {
        const value = text
          .split(/[\s,]+/)
          .filter(Boolean)
          .join(",");
        const res = await setRustdeskOption("whitelist", value);
        if (!res.ok) toast(t("option_failed"));
        onSaved(res.value ?? value);
      }}
    >
      <TextField value={text} onChange={(e) => setText(e.target.value)} />
    </ConfirmModal>
  );
}
