import { addEventListener, removeEventListener } from "@decky/api";
import { useEffect, useState } from "react";

import { type Password, type Status, getPassword, getStatus, installLatest, refreshPassword } from "./backend";
import { t } from "./i18n";
import { toast } from "./toast";

const POLL_MS = 2000;

export function usePolledStatus(): [Status | null, () => void, (s: Status) => void] {
  const [status, setStatus] = useState<Status | null>(null);
  const poll = () =>
    getStatus()
      .then(setStatus)
      .catch((e) => console.error("RustDeck: get_status failed", e));
  useEffect(() => {
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => clearInterval(timer);
  }, []);
  return [status, poll, setStatus];
}

export function usePassword(status: Status | null): [Password | null, () => Promise<void>] {
  const [password, setPassword] = useState<Password | null>(null);
  const active = !!status?.active;
  useEffect(() => {
    if (active) getPassword().then(setPassword);
    else setPassword(null);
    // A finished session changes the temporary password, so read it again when that happens.
  }, [active, status?.connections]);
  const refresh = async () => setPassword(await refreshPassword());
  return [password, refresh];
}

/** Installs (or updates to) the latest release; `progress` is 0..1 while it runs, else null. */
export function useInstall(onDone: () => void): { progress: number | null; label: string | null; install: () => void } {
  const [bytes, setBytes] = useState<[number, number] | null>(null);
  useEffect(() => {
    const listener = addEventListener<[done: number, total: number]>("install_progress", (done, total) => setBytes([done, total]));
    return () => {
      removeEventListener("install_progress", listener);
    };
  }, []);

  const install = async () => {
    if (bytes) return;
    setBytes([0, 0]);
    const res = await installLatest();
    setBytes(null);
    toast(res.ok ? t("installed_toast", { tag: res.tag ?? "" }) : `${t("install_failed")}: ${res.error ?? ""}`);
    onDone();
  };

  const MB = 1024 * 1024;
  return {
    progress: bytes ? (bytes[1] ? bytes[0] / bytes[1] : 0) : null,
    label: bytes
      ? t("installing", { done: (bytes[0] / MB).toFixed(1), total: bytes[1] ? (bytes[1] / MB).toFixed(1) : "?" })
      : null,
    install: () => void install(),
  };
}
