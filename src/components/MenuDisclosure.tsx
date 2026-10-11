"use client";

import { useRef, type ReactNode } from "react";

/**
 * The small-screen menu: a native <details>, so it still opens without JavaScript. Escape closes it
 * and puts focus back on the Menu button, as keyboard users expect from a disclosure menu.
 */
export function MenuDisclosure({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={ref}
      className={className}
      onKeyDown={(e) => {
        if (e.key !== "Escape" || !ref.current?.open) return;
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }}
    >
      {children}
    </details>
  );
}
