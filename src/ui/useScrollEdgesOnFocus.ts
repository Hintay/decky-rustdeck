import { useEffect, type RefObject } from "react";

const ROW_TOLERANCE_PX = 12;

// Headings and hints above a page's first row of controls (and text or padding below its last
// row) can never hold gamepad focus, so moving to those controls only scrolls them to the edge
// and the content beyond stays hidden. When any control in the first or last row of the scroll
// container gains focus (e.g. any tile in the last row of a grid), scroll the container all the
// way up or down. It runs on the next frames because Steam applies its own scroll-into-view after
// the focus event.
export function useScrollEdgesOnFocus(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onFocusIn = (event: Event) => {
      const target = event.target as Node | null;
      if (!target) return;
      const controls = Array.from(container.querySelectorAll<HTMLElement>(".Focusable"))
        .filter((el) => !el.querySelector(".Focusable"));
      const focused = controls.find((el) => el === target || el.contains(target));
      if (!focused || !controls.length) return;
      // Same row as the first or last control. The tolerance absorbs the focused tile's scale-up.
      const rowTop = (el: HTMLElement) => el.getBoundingClientRect().top;
      const sameRow = (a: HTMLElement, b: HTMLElement) => Math.abs(rowTop(a) - rowTop(b)) <= ROW_TOLERANCE_PX;
      const top = sameRow(focused, controls[0]) ? 0
        : sameRow(focused, controls[controls.length - 1]) ? container.scrollHeight : undefined;
      if (top === undefined) return;
      const scroll = () => container.scrollTo({ top });
      window.requestAnimationFrame(() => { scroll(); window.requestAnimationFrame(scroll); });
    };
    container.addEventListener("focusin", onFocusIn);
    return () => container.removeEventListener("focusin", onFocusIn);
  }, [containerRef]);
}
