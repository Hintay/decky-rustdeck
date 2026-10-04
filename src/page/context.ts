import type { RustdeskSettings, Server, Status } from "../backend";

/** What every page of the full-screen view reads and changes. */
export interface PageCtx {
  status: Status;
  setStatus: (s: Status) => void;
  refreshStatus: () => void;
  rs: RustdeskSettings | null;
  server: Server;
  setServer: (s: Server) => void;
  /** Reads RustDesk's options (and the server) again. */
  reload: () => Promise<void>;
  value: (name: string) => string;
  isOn: (name: string) => boolean;
  setOption: (name: string, value: string) => Promise<void>;
  setBool: (name: string, on: boolean) => Promise<void>;
}
