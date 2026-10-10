"use client";

/* Section menu for screens where the header nav is hidden (< 1100px).
   Solid panel (no backdrop-filter over the canvas); it fades/slides only when full motion is on (html.motion-ok).
   Escape, a link click or a click elsewhere in the header closes it, focus moves into the panel on open and back
   to the button on close, and page scroll is locked while it is open. Works without the 3D and down to 320px. */

import { useCallback, useEffect, useRef, useState } from "react";

type NavItem = { href: string; label: string };

const WIDE = "(min-width: 1100px)";

export function MobileMenu({ items, cta }: { items: NavItem[]; cta: NavItem }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback((returnFocus = true) => {
    document.documentElement.classList.remove("menu-open");
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.classList.add("menu-open");
    panelRef.current?.querySelector<HTMLElement>("a")?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current || !buttonRef.current) return;
      // keep focus inside the button + panel while the menu covers the page
      const links = Array.from(panelRef.current.querySelectorAll<HTMLElement>("a"));
      const first = buttonRef.current;
      const last = links[links.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    // a click on the header outside the menu (brand, motion toggle, CTA) closes it and leaves focus where it landed
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      close(false);
    };
    const mq = window.matchMedia(WIDE);
    const onWide = () => {
      if (mq.matches) close(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick, true);
    mq.addEventListener("change", onWide);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick, true);
      mq.removeEventListener("change", onWide);
      root.classList.remove("menu-open");
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="menu-button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => (open ? close() : setOpen(true))}
      >
        <svg viewBox="0 0 20 14" width="20" height="14" aria-hidden="true">
          {open ? (
            <path d="M4 1 L16 13 M16 1 L4 13" stroke="currentColor" strokeWidth="1.6" />
          ) : (
            <path d="M1 2 H19 M1 7 H19 M1 12 H19" stroke="currentColor" strokeWidth="1.6" />
          )}
        </svg>
        <span className="menu-button-label">Menu</span>
      </button>
      <div ref={panelRef} id="mobile-menu" className="mobile-menu" data-open={open || undefined}>
        <nav aria-label="Sections">
          <ul>
            {items.map((n) => (
              <li key={n.href}>
                <a href={n.href} onClick={() => close()}>
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <a href={cta.href} className="btn btn--gold mobile-menu-cta" onClick={() => close()}>
          {cta.label}
        </a>
      </div>
    </>
  );
}
