"use client";

import { useEffect, useId, useRef, useState } from "react";

type Suggestion = { type: "destination" | "guide" | "update"; label: string; detail: string; href: string };

/**
 * The search box with suggestions as you type (WAI-ARIA combobox with a list box).
 *
 * - Without JavaScript it is a plain search field; the form still submits.
 * - Waits 150 ms after typing stops, then asks /search/suggest; an older request is cancelled.
 * - Arrow keys move through suggestions, Enter opens the highlighted one (or submits the form when
 *   none is highlighted), Escape closes the list. The number of suggestions is announced.
 */
export function SearchCombobox({ id, name, defaultValue, maxLength, className, describedBy }: {
  id: string;
  name: string;
  defaultValue: string;
  maxLength: number;
  className: string;
  describedBy?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [announce, setAnnounce] = useState("");
  const listId = useId();
  const typed = useRef(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!typed.current) return;
    const q = value.trim();
    // Short text: onChange has already cleared the list.
    if (q.length < 2) return;
    const timer = window.setTimeout(async () => {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      try {
        const res = await fetch(`/search/suggest?q=${encodeURIComponent(q.slice(0, 50))}`, { signal: controller.signal, headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { items?: Suggestion[] };
        const next = Array.isArray(data.items) ? data.items : [];
        setItems(next);
        setActive(-1);
        setOpen(next.length > 0);
        setAnnounce(next.length ? `${next.length} suggestion${next.length === 1 ? "" : "s"}. Use the up and down arrows to choose.` : "");
      } catch {
        // A cancelled or failed request simply shows no suggestions; the search button still works.
        if (!controller.signal.aborted) {
          setItems([]);
          setOpen(false);
        }
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [value]);

  useEffect(() => () => request.current?.abort(), []);

  const go = (s: Suggestion) => {
    setOpen(false);
    window.location.assign(s.href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && items.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp" && items.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter" && open && active >= 0 && items[active]) {
      e.preventDefault();
      go(items[active]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  };

  const optionId = (i: number) => `${listId}-option-${i}`;
  const typeLabel = { destination: "Place", guide: "Guide", update: "Update" } as const;

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        maxLength={maxLength}
        value={value}
        onChange={(e) => {
          typed.current = true;
          setValue(e.target.value);
          if (e.target.value.trim().length < 2) {
            request.current?.abort();
            setItems([]);
            setOpen(false);
            setActive(-1);
            setAnnounce("");
          }
        }}
        onKeyDown={onKeyDown}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onFocus={() => items.length && setOpen(true)}
        className={className}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Suggestions"
        hidden={!open}
        className="absolute left-0 right-0 top-full z-20 mt-1 list-none m-0 p-1 bg-paper-000 border border-line-500 rounded-md shadow-lg max-h-96 overflow-auto"
      >
        {items.map((s, i) => (
          <li
            key={s.href}
            id={optionId(i)}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => {
              e.preventDefault();
              go(s);
            }}
            onMouseEnter={() => setActive(i)}
            className={`flex items-baseline justify-between gap-3 px-3 py-2 min-h-11 rounded-sm cursor-pointer ${i === active ? "bg-paper-200" : ""}`}
          >
            <span className="t-ui text-ink-900">{s.label}</span>
            <span className="t-meta text-ink-400 shrink-0">{s.type === "destination" ? s.detail : typeLabel[s.type]}</span>
          </li>
        ))}
      </ul>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
    </div>
  );
}
