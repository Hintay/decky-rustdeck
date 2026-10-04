import { callable } from "@decky/api";

export interface Status {
  installed: string | null;
  enabled: boolean;
  active: boolean;
  id: string | null;
  connections: number;
  composite: boolean;
  auto_composite: boolean;
  prefer_portal: boolean;
  busy: boolean;
}

export interface Password {
  available: boolean;
  temporary?: string | null;
  permanent_set?: boolean;
  method?: string;
}

export interface Release {
  tag: string;
  deb_url: string;
  sha_url: string | null;
  size: number;
  published: string;
}

export interface UpdateInfo {
  installed: string | null;
  latest: Release | null;
  error: string | null;
}

export type Server = Partial<Record<"custom-rendezvous-server" | "relay-server" | "api-server" | "key", string>>;

export const getStatus = callable<[], Status>("get_status");
export const getPassword = callable<[], Password>("get_password");
export const refreshPassword = callable<[], Password>("refresh_password");
export const setEnabled = callable<[enabled: boolean], Status>("set_enabled");
export const disconnectAll = callable<[], void>("disconnect_all");
export const setAutoComposite = callable<[on: boolean], Status>("set_auto_composite");
export const setPreferPortal = callable<[on: boolean], Status>("set_prefer_portal");
export const checkUpdate = callable<[], UpdateInfo>("check_update");
export const installLatest = callable<[], { ok: boolean; tag?: string; error?: string }>("install_latest");
export const uninstallRustdesk = callable<[], Status>("uninstall_rustdesk");
export const getServer = callable<[], Server>("get_server");
export const applyServerConfig = callable<[config: string], { ok: boolean; server: Server | null }>("apply_server_config");
export interface RustdeskSettings {
  available: boolean;
  values?: Record<string, string>;
  off_by_default?: string[];
  /** null when the service is stopped and the answer is unknown. */
  permanent_set?: boolean | null;
}

export const getRustdeskSettings = callable<[], RustdeskSettings>("get_rustdesk_settings");
export const setRustdeskOption = callable<[name: string, value: string], { ok: boolean; value?: string; error?: string }>(
  "set_rustdesk_option",
);
export const clearServer = callable<[], Server>("clear_server");
export const setPermanentPassword = callable<[password: string], { ok: boolean; error?: string }>(
  "set_permanent_password",
);
export const getShortcut = callable<[], { appid: number | null; artwork_applied: boolean }>("get_shortcut");
export const setArtworkApplied = callable<[appid: number], void>("set_artwork_applied");
export const getArtwork = callable<[], Record<"grid_p" | "grid_l" | "hero" | "logo", string>>("get_artwork");
export const installShortcutIcon = callable<[appid: number], string | null>("install_shortcut_icon");
export const setShortcut = callable<[appid: number | null], void>("set_shortcut");
