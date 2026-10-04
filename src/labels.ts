import type { RustdeskSettings, Status } from "./backend";
import { t } from "./i18n";

export function stateLabel(status: Status | null): string {
  if (!status || status.busy) return t("state_busy");
  if (!status.installed) return t("not_installed_short");
  if (!status.active) return t("state_stopped");
  return status.connections > 0 ? t("state_connected", { n: status.connections }) : t("state_running");
}

export function verificationLabel(method: string): string {
  return method === "use-temporary-password" ? t("vm_temp") : method === "use-permanent-password" ? t("vm_perm") : t("vm_both");
}

/** Permanent-password-only verification without a permanent password: nobody can connect. */
export function lockedOut(rs: RustdeskSettings | null): boolean {
  return rs?.values?.["verification-method"] === "use-permanent-password" && rs.permanent_set === false;
}
