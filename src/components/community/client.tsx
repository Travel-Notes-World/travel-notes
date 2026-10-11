"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { findDestinationsAction, type DestinationOption } from "@/lib/community/actions/lookup";
import type { ActionState } from "@/lib/community/next/forms";
import { FieldError } from "./ui";

/** A submit button that shows it is working and cannot be pressed twice. */
export function SubmitButton({ children, pendingText = "Saving…", className, name, value, variant = "primary" }: { children: ReactNode; pendingText?: string; className?: string; name?: string; value?: string; variant?: "primary" | "secondary" }) {
  const { pending } = useFormStatus();
  const base = variant === "primary"
    ? "inline-flex items-center justify-center min-h-11 px-5 rounded-md bg-marine-600 text-on-marine t-ui hover:bg-marine-700 disabled:opacity-60 disabled:cursor-wait"
    : "inline-flex items-center justify-center min-h-11 px-4 rounded-md border border-line-500 bg-paper-000 text-ink-900 t-ui hover:border-ink-900 disabled:opacity-60";
  return (
    <button type="submit" name={name} value={value} disabled={pending} aria-disabled={pending} className={className ?? base}>
      {pending ? pendingText : children}
    </button>
  );
}

/**
 * The message after a form action. It is announced to screen readers, and on an error the page
 * moves focus to it so keyboard users are not left at the bottom of a long form.
 */
export function FormMessage({ state, successTitle = "Saved" }: { state: ActionState; successTitle?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.message && ref.current) ref.current.focus();
  }, [state]);
  if (!state.message) return <div aria-live="polite" className="sr-only" />;
  const error = state.ok === false;
  const fieldCount = Object.keys(state.fields ?? {}).length;
  return (
    <div ref={ref} tabIndex={-1} role={error ? "alert" : "status"} className={`mt-4 mb-2 border-l-4 rounded-sm p-4 max-w-measure ${error ? "border-signal-error bg-paper-100" : "border-signal-success bg-paper-100"}`}>
      <p className="t-ui m-0">{error ? "There is a problem" : successTitle}</p>
      <p className="t-body-sm m-0 mt-1">{state.message}</p>
      {error && fieldCount > 0 && <p className="t-body-sm m-0 mt-1">{fieldCount === 1 ? "1 field needs attention." : `${fieldCount} fields need attention.`}</p>}
      {state.code === "auth" && <p className="t-body-sm m-0 mt-2"><Link href="/account/sign-in" target="_blank" className="text-marine-600 underline">Sign in again in a new tab</Link></p>}
    </div>
  );
}

/**
 * Keep a copy of a long form in this browser while it is being written, so text survives an
 * expired session, a closed tab or a lost connection. Stored only on the member's own device.
 */
/** Fields never copied into browser storage: contact details stay on the server only. */
const PRIVATE_FIELDS = new Set(["contact", "organiserContact", "email"]);

export function useDraftBackup(key: string, enabled = true) {
  const formRef = useRef<HTMLFormElement>(null);
  const [restorable, setRestorable] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    try {
      const saved = window.localStorage.getItem(key);
      // Browser storage only exists after the page loads, so it is read here rather than during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setRestorable(JSON.parse(saved));
    } catch { /* storage may be blocked */ }
  }, [key, enabled]);
  useEffect(() => {
    const form = formRef.current;
    if (!form || !enabled) return;
    const save = () => {
      const data: Record<string, string> = {};
      new FormData(form).forEach((value, name) => {
        if (typeof value === "string" && !name.startsWith("$") && !name.toLowerCase().includes("password") && !PRIVATE_FIELDS.has(name)) data[name] = value;
      });
      try { window.localStorage.setItem(key, JSON.stringify(data)); } catch { /* full or blocked */ }
    };
    form.addEventListener("input", save);
    return () => form.removeEventListener("input", save);
  }, [key, enabled]);
  const clear = () => { try { window.localStorage.removeItem(key); } catch { /* ignore */ } setRestorable(null); };
  return { formRef, restorable, clear };
}

/** Offer to bring back text kept in this browser from an earlier attempt. */
export function RestoreBanner({ restorable, onRestore, onDiscard }: { restorable: Record<string, string> | null; onRestore: () => void; onDiscard: () => void }) {
  if (!restorable || !Object.values(restorable).some((v) => v && v.length > 20)) return null;
  return (
    <div role="status" className="mt-4 border-l-4 border-ochre-500 bg-ochre-100 rounded-sm p-4 max-w-measure">
      <p className="t-ui m-0">Unsaved text found</p>
      <p className="t-body-sm m-0 mt-1">This browser kept text from an earlier attempt that was not saved.</p>
      <div className="mt-3 flex gap-3">
        <button type="button" onClick={onRestore} className="min-h-11 px-4 rounded-md bg-marine-600 text-on-marine t-ui">Bring it back</button>
        <button type="button" onClick={onDiscard} className="min-h-11 px-4 rounded-md border border-line-500 t-ui">Discard it</button>
      </div>
    </div>
  );
}

/** Copy saved values back into the form's fields by name. */
export function restoreInto(form: HTMLFormElement | null, values: Record<string, string>) {
  if (!form) return;
  for (const [name, value] of Object.entries(values)) {
    const field = form.elements.namedItem(name);
    if (field instanceof HTMLInputElement && field.type !== "hidden" && field.type !== "file" && field.type !== "checkbox") field.value = value;
    if (field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) field.value = value;
  }
}

export type PickedPlace = { id: string; label: string };

/**
 * Choose destinations by typing a name. The member always chooses: nothing is selected for them,
 * and their location is never guessed. Each choice is sent as a hidden field with the record id.
 */
export function DestinationPicker({ name = "destinations", label = "Destinations", hint, initial, max = 5, error, required = false, onTimeZone }: {
  name?: string; label?: string; hint?: string; initial: PickedPlace[]; max?: number; error?: string; required?: boolean; onTimeZone?: (zone: string | null) => void;
}) {
  const id = useId();
  const [picked, setPicked] = useState<PickedPlace[]>(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DestinationOption[]>([]);
  const [status, setStatus] = useState("");
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await findDestinationsAction(q).catch(() => []);
      if (cancelled) return;
      setResults(found);
      setStatus(found.length ? `${found.length} place${found.length === 1 ? "" : "s"} found. Use Tab to reach them.` : "No places found with that name.");
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);
  const add = (option: DestinationOption) => {
    if (picked.some((p) => p.id === option.id) || picked.length >= max) return;
    setPicked([...picked, { id: option.id, label: option.label }]);
    if (picked.length === 0) onTimeZone?.(option.timeZone);
    setQuery("");
    setResults([]);
    setStatus(`${option.label} added.`);
  };
  return (
    <fieldset className="mt-5 border-0 p-0 m-0 min-w-0">
      <legend className="t-ui text-ink-900 p-0">{label}{required && <span className="text-ink-600 font-normal"> (required)</span>}</legend>
      <p id={`${id}-hint`} className="t-body-sm text-ink-600 mt-1 mb-2">{hint ?? `Type at least two letters of a country, region or city, then choose from the list. Up to ${max}.`}</p>
      {picked.length > 0 && (
        <ul className="flex flex-wrap gap-2 list-none m-0 p-0 mb-3" aria-label="Chosen destinations">
          {picked.map((p) => (
            <li key={p.id} className="inline-flex items-center gap-1 rounded-sm bg-marine-100 pl-3 t-body-sm">
              <input type="hidden" name={name} value={p.id} />
              {p.label}
              <button type="button" onClick={() => { setPicked(picked.filter((x) => x.id !== p.id)); setStatus(`${p.label} removed.`); }} className="min-h-11 min-w-11 t-ui text-ink-900" aria-label={`Remove ${p.label}`}>×</button>
            </li>
          ))}
        </ul>
      )}
      {picked.length < max && (
        <input
          id={id}
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (e.target.value.trim().length < 2) { setResults([]); setStatus(""); } }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (results[0]) add(results[0]); } }}
          autoComplete="off"
          aria-describedby={`${id}-hint ${id}-status${error ? ` ${id}-error` : ""}`}
          aria-invalid={error ? true : undefined}
          aria-label={`Search for a destination to add to ${label.toLowerCase()}`}
          placeholder="For example: Bangkok, Japan, Bali"
          className="w-full min-h-11 px-3 py-2 rounded-sm border border-line-500 bg-paper-000 text-ink-900 t-body-sm aria-[invalid=true]:border-signal-error aria-[invalid=true]:border-2"
        />
      )}
      <p id={`${id}-status`} aria-live="polite" className="sr-only">{status}</p>
      {results.length > 0 && (
        <ul className="mt-2 list-none m-0 p-0 border border-line-500 rounded-sm bg-paper-000 divide-y divide-paper-200" aria-label="Matching places">
          {results.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => add(r)} className="w-full text-left min-h-11 px-3 py-2 t-body-sm hover:bg-paper-100 focus-visible:bg-paper-100">
                {r.label} <span className="text-ink-400">· {r.kind === "area" ? "travel area" : r.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <FieldError id={`${id}-error`} message={error} />
      <p className="t-body-sm text-ink-600 mt-2 mb-0">Not in the list? <Link href="/account/suggest-destination" className="text-marine-600 underline" target="_blank">Suggest a destination</Link> (opens in a new tab). A moderator adds it; you can save your draft meanwhile.</p>
    </fieldset>
  );
}
