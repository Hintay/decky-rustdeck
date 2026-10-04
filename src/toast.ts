import { toaster } from "@decky/api";

export function toast(body: string) {
  toaster.toast({ title: "RustDeck", body });
}
