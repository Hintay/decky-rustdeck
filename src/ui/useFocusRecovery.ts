import { useEffect, type RefObject } from "react";

// When the gamepad-focused control is removed (an action hides its own button, a list row goes
// away after it is handled), Steam leaves nothing focused and the d-pad stops responding until
// the page is re-entered. This keeps the ancestors of the last focused control inside the root,
// and when that control is detached, focuses the first control in the nearest ancestor that is
// still on the page.
export function useFocusRecovery(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const doc = root.ownerDocument;
    let focused: Element | null = null;
    let ancestors: Element[] = [];

    const onFocusIn = (event: Event) => {
      const target = event.target as Element | null;
      if (!target || !root.contains(target)) return;
      focused = target;
      ancestors = [];
      for (let el = target.parentElement; el && el !== root.parentElement; el = el.parentElement) ancestors.push(el);
    };

    const recover = () => {
      if (!focused || focused.isConnected) return;
      const live = doc.querySelector(".gpfocus");
      if (live && live.isConnected && live !== doc.body) { focused = null; return; }
      for (const ancestor of ancestors) {
        if (!ancestor.isConnected) continue;
        // A leaf control, not a container that only groups other focusables.
        const candidate = Array.from(ancestor.querySelectorAll<HTMLElement>(".Focusable:not([disabled])"))
          .find((el) => !el.querySelector(".Focusable"));
        if (candidate) { candidate.focus(); return; }
      }
      focused = null;
    };

    // Recovery runs after React commits, so the removal is observed as a DOM mutation.
    const observer = new MutationObserver(() => { if (focused && !focused.isConnected) window.setTimeout(recover, 0); });
    observer.observe(root, { childList: true, subtree: true });
    root.addEventListener("focusin", onFocusIn);
    return () => {
      observer.disconnect();
      root.removeEventListener("focusin", onFocusIn);
    };
  }, [rootRef]);
}
