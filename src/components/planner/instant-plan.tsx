"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { writePreviewAction, type PreviewState } from "@/lib/planner/actions";
import type { Preview } from "@/lib/planner/preview";

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function PreviewDays({ preview }: { preview: Preview }) {
  const [summary, ...checks] = preview.summary.split("\n");
  return (
    <div>
      {summary && <p className="t-body mt-0">{summary}</p>}
      <ol className="list-none m-0 p-0 grid gap-5">
        {preview.days.map((d, i) => (
          <li key={i} className="border-t border-paper-200 pt-4">
            <h3 className="t-heading-3 m-0">Day {i + 1}{d.date ? ` · ${fmt(d.date)}` : ""}{d.title ? ` · ${d.title}` : ""}</h3>
            <ul className="list-none m-0 mt-2 p-0 grid gap-3">
              {d.stops.map((s, j) => (
                <li key={j} className="t-body-sm">
                  <strong className="t-ui">{s.title}</strong>{s.place ? ` · ${s.place}` : ""}
                  {s.notes && <><br />{s.notes}</>}
                  <br />
                  {s.origin === "travel_notes" && s.sourcePath
                    ? <Link href={s.sourcePath} className="text-marine-600 underline">From Travel Notes</Link>
                    : <span className="text-ochre-700">AI idea, not checked by Travel Notes</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {checks.length > 0 && (
        <div className="mt-6">
          <h3 className="t-heading-3 m-0">Check before you go</h3>
          <ul className="t-body-sm mt-2 mb-0 pl-5">{checks.map((c) => <li key={c}>{c.replace(/^•\s*/, "")}</li>)}</ul>
        </div>
      )}
      <p className="t-body-sm text-ink-600 mt-6 mb-0">Written by AI using Travel Notes content first. It gives no prices or opening hours: check them with official sources before you go.</p>
    </div>
  );
}

/**
 * The real itinerary, written straight away for the visitor. It starts by itself when the page
 * opens, shows progress while the AI writes (usually under a minute), and shows the answer here.
 */
export function InstantPlan({ query, initial, signedIn }: { query: string; initial: Preview | null; signedIn: boolean }) {
  const [state, setState] = useState<PreviewState | { status: "loading" }>(initial ? { status: "ready", preview: initial } : { status: "loading" });
  const [seconds, setSeconds] = useState(0);
  const started = useRef(false);

  const start = useCallback(() => {
    setState({ status: "loading" });
    setSeconds(0);
    writePreviewAction(query).then(setState).catch(() => setState({ status: "error", message: "The connection was interrupted. Please try again." }));
  }, [query]);

  useEffect(() => {
    if (initial || started.current) return;
    started.current = true;
    start();
  }, [initial, start]);

  useEffect(() => {
    if (state.status !== "loading") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [state.status]);

  if (state.status === "ready") return <PreviewDays preview={state.preview} />;
  if (state.status === "loading") {
    return (
      <div role="status" aria-live="polite">
        <p className="t-ui m-0">Writing your itinerary… {seconds > 0 ? `${seconds} s` : ""}</p>
        <p className="t-body-sm text-ink-600 mt-1 mb-4">This usually takes 30 to 60 seconds. You can keep reading below while you wait.</p>
        <div className="grid gap-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-md border border-paper-200 p-4 animate-pulse">
              <div className="h-4 w-1/3 rounded bg-paper-200" />
              <div className="h-3 w-5/6 rounded bg-paper-200 mt-3" />
              <div className="h-3 w-2/3 rounded bg-paper-200 mt-2" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (state.status === "limited") {
    return (
      <div className="rounded-md border border-paper-200 p-4">
        <p className="t-ui m-0">You have used today’s free instant itinerary.</p>
        <p className="t-body-sm mt-1 mb-0">{signedIn ? "Save this plan below: the AI helper in your account can write it, and your first plan there is free." : "Create a free account and save this plan: your first AI plan in your account is free too."}</p>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="rounded-md border border-signal-error p-4" role="alert">
        <p className="t-ui m-0">The itinerary could not be written</p>
        <p className="t-body-sm mt-1">{state.message}</p>
        <button type="button" onClick={start} className="inline-flex items-center justify-center min-h-11 px-4 rounded-md border border-line-500 bg-paper-000 t-ui hover:border-ink-900">Try again</button>
      </div>
    );
  }
  return null;
}
