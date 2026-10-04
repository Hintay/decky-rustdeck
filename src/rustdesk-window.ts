// Open RustDesk's own window in Game Mode. gamescope only shows apps Steam launched, so the
// window is started through a non-Steam shortcut the plugin creates once and then reuses. The
// shortcut is hidden from the library and given artwork for the "now playing" views.
import { getArtwork, getShortcut, installShortcutIcon, setArtworkApplied, setShortcut } from "./backend";
import { t } from "./i18n";
import { toast } from "./toast";

declare const SteamClient: any;
declare const appStore: any;
declare const collectionStore: any;

const EXE = "/usr/bin/rustdesk";
// Steam's custom artwork slots.
const ASSET_TYPES = { grid_p: 0, hero: 1, logo: 2, grid_l: 3 } as const;

function shortcutExists(appId: number): boolean {
  return !!appStore?.GetAppOverviewByAppID?.(appId);
}

async function ensureShortcut(): Promise<number> {
  const saved = await getShortcut();
  if (saved.appid != null && shortcutExists(saved.appid)) {
    if (!saved.artwork_applied) await applyArtwork(saved.appid);
    return saved.appid;
  }
  const appId: number = await SteamClient.Apps.AddShortcut("RustDesk", EXE, "/usr/bin", "");
  SteamClient.Apps.SetShortcutName(appId, "RustDesk");
  await setShortcut(appId);
  await applyArtwork(appId);
  return appId;
}

async function applyArtwork(appId: number): Promise<void> {
  const art = await getArtwork();
  for (const [name, type] of Object.entries(ASSET_TYPES)) {
    await SteamClient.Apps.SetCustomArtworkForApp(appId, art[name as keyof typeof ASSET_TYPES], "png", type);
  }
  // After the artwork, which creates the grid folder the icon is copied into.
  const icon = await installShortcutIcon(appId);
  if (icon) SteamClient.Apps.SetShortcutIcon(appId, icon);
  await setArtworkApplied(appId);
}

// Steam's UI language (e.g. "zh-cn", "ja", "pt-br") → a glibc locale. SteamOS itself stays en_US and
// Steam launches shortcuts with LC_ALL=C, so without this RustDesk (which follows the locale) always
// comes up in English.
const DEFAULT_REGION: Record<string, string> = {
  zh: "CN", ja: "JP", ko: "KR", de: "DE", fr: "FR", es: "ES", it: "IT", pt: "PT", ru: "RU", pl: "PL",
  uk: "UA", tr: "TR", nl: "NL", sv: "SE", cs: "CZ", hu: "HU", vi: "VN", th: "TH", id: "ID", en: "US",
};

function steamLocale(): string | null {
  const code: string | undefined = (window as any).LocalizationManager?.m_rgLocalesToUse?.[0];
  const m = code?.toLowerCase().match(/^([a-z]{2})(?:-([a-z]{2}|419))?$/);
  if (!m) return null;
  const [, lang, region] = m;
  if (region === "419") return `${lang}_MX`;
  const r = region?.toUpperCase() ?? DEFAULT_REGION[lang];
  return r ? `${lang}_${r}` : null;
}

function launchOptions(): string {
  const locale = steamLocale();
  return locale ? `LC_ALL=${locale}.UTF-8 LANG=${locale}.UTF-8 %command%` : "";
}

export async function openRustDeskWindow(): Promise<void> {
  const appId = await ensureShortcut();
  // Hidden apps still launch; this only keeps the shortcut out of the library and its lists.
  collectionStore?.SetAppsAsHidden?.([appId], true);
  SteamClient.Apps.SetAppLaunchOptions(appId, launchOptions());
  // A non-Steam shortcut's game id: the app id in the high 32 bits, type 0x02000000 below.
  const gameId = ((BigInt(appId) << 32n) | 0x02000000n).toString();
  SteamClient.Apps.RunGame(gameId, "", -1, 100);
}

/** Opens the window, reporting a failure as a toast. */
export function openRustDesk(): void {
  openRustDeskWindow().catch((e) => toast(`${t("open_failed")}: ${e}`));
}
