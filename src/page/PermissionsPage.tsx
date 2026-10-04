import { Focusable } from "@decky/ui";
import type { ReactNode } from "react";
import { FaClipboard, FaFolderOpen, FaKeyboard, FaRedoAlt, FaVideo, FaVolumeUp } from "react-icons/fa";

import { type Key, t } from "../i18n";
import { SectionTitle, Tag, ToggleTile } from "../ui/primitives";
import { ACCENT } from "../ui/theme";
import type { PageCtx } from "./context";
import { NotInstalled } from "./NotInstalled";

const PERMISSIONS: [string, Key, ReactNode][] = [
  ["enable-keyboard", "perm_keyboard", <FaKeyboard />],
  ["enable-clipboard", "perm_clipboard", <FaClipboard />],
  ["enable-file-transfer", "perm_file_transfer", <FaFolderOpen />],
  ["enable-audio", "perm_audio", <FaVolumeUp />],
  ["enable-remote-restart", "perm_remote_restart", <FaRedoAlt />],
  ["enable-record-session", "perm_record", <FaVideo />],
];

export function PermissionsPage({ ctx }: { ctx: PageCtx }) {
  if (!ctx.status.installed || !ctx.rs?.available) return <NotInstalled onDone={ctx.refreshStatus} />;
  const allowed = PERMISSIONS.filter(([name]) => ctx.isOn(name)).length;
  return (
    <>
      <SectionTitle aside={<Tag color={ACCENT}>{t("permissions_count", { n: allowed, total: PERMISSIONS.length })}</Tag>}>
        {t("section_remote_may")}
      </SectionTitle>
      <Focusable flow-children="grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {PERMISSIONS.map(([name, label, icon]) => {
          const on = ctx.isOn(name);
          return (
            <ToggleTile
              key={name}
              icon={icon}
              label={t(label)}
              state={on ? t("allowed") : t("blocked")}
              checked={on}
              onChange={(v) => ctx.setBool(name, v)}
            />
          );
        })}
      </Focusable>
    </>
  );
}
