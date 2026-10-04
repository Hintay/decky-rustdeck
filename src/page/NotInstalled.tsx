import { FaDownload, FaSyncAlt } from "react-icons/fa";

import { useInstall } from "../hooks";
import { t } from "../i18n";
import { ActionButton, Beacon, EmptyState } from "../ui/primitives";

/** Installs or updates RustDesk; the button fills up with the download. */
export function InstallAction({ label, onDone, variant = "primary" }: { label: string; onDone: () => void; variant?: "primary" }) {
  const { progress, label: busyLabel, install } = useInstall(onDone);
  return (
    <ActionButton variant={variant} disabled={progress !== null} progress={progress ?? undefined} onClick={install}>
      {progress !== null ? <FaSyncAlt className="rd-spin" /> : <FaDownload />}
      {busyLabel ?? label}
    </ActionButton>
  );
}

export function NotInstalled({ onDone }: { onDone: () => void }) {
  return (
    <EmptyState icon={<Beacon tone="off" size={72} />} title={t("not_installed")} body={t("not_installed_desc")}>
      <InstallAction label={t("install")} onDone={onDone} />
    </EmptyState>
  );
}
