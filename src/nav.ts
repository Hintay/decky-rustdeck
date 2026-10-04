import { Navigation } from "@decky/ui";

export const ROUTE = "/rustdeck";
export const NAV_EVENT = "rustdeck:navigate";

export const PAGES = ["overview", "security", "permissions", "network", "capture", "about"] as const;
export type PageId = (typeof PAGES)[number];

let pendingPage: PageId = "overview";

export function getPendingPage(): PageId {
  return pendingPage;
}

export function openPage(page: PageId = "overview"): void {
  pendingPage = page;
  window.dispatchEvent(new CustomEvent(NAV_EVENT, { detail: page }));
  Navigation.Navigate(ROUTE);
  Navigation.CloseSideMenus();
}
