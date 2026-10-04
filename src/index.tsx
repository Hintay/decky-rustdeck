import { DialogButton, staticClasses } from "@decky/ui";
import { definePlugin, routerHook } from "@decky/api";
import { FaCog, FaDesktop } from "react-icons/fa";

import { ROUTE, openPage } from "./nav";
import { RustDeckPage } from "./page/RustDeckPage";
import { QuickAccessPanel } from "./qam";

function TitleView() {
  return (
    <div className={staticClasses.Title} style={{ display: "flex", alignItems: "center", width: "100%" }}>
      <span style={{ flex: 1 }}>RustDeck</span>
      <DialogButton
        style={{ height: "28px", width: "40px", minWidth: 0, padding: "0", display: "flex", alignItems: "center", justifyContent: "center" }}
        onClick={() => openPage()}
      >
        <FaCog />
      </DialogButton>
    </div>
  );
}

export default definePlugin(() => {
  routerHook.addRoute(ROUTE, RustDeckPage, { exact: true });
  return {
    name: "RustDeck",
    titleView: <TitleView />,
    content: <QuickAccessPanel />,
    icon: <FaDesktop />,
    onDismount() {
      routerHook.removeRoute(ROUTE);
    },
  };
});
