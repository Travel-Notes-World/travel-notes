"use client";

import { useEffect, useState } from "react";

type Props = { timeZone: string; offset: string };

/** "5:52 pm Saturday" and the current UTC offset in the destination's time zone. */
function readClock(timeZone: string, now: Date) {
  try {
    const time = new Intl.DateTimeFormat("en-AU", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(now);
    const day = new Intl.DateTimeFormat("en-AU", { timeZone, weekday: "long" }).format(now);
    const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" }).formatToParts(now).find((p) => p.type === "timeZoneName")?.value;
    const offset = !part ? "" : part === "GMT" ? "UTC+0" : part.replace("GMT", "UTC");
    return { text: `${time} ${day}`, offset };
  } catch {
    return null;
  }
}

/**
 * Live local time for a destination. The server sends only the time zone, because pages are cached
 * and a server-rendered clock would be out of date. The browser fills in the time and updates it each minute.
 * The offset is worked out again in the browser, so daylight saving changes show correctly.
 */
export function LocalTime({ timeZone, offset }: Props) {
  const [clock, setClock] = useState<{ text: string; offset: string } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const now = new Date();
      setClock(readClock(timeZone, now));
      // Wait until the start of the next minute, so the clock changes when a real clock does.
      timer = setTimeout(tick, 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
    };
    tick();
    return () => clearTimeout(timer);
  }, [timeZone]);

  const zone = timeZone.replace(/_/g, " ");
  return (
    <>
      {/* The space is kept while the time loads, so the box does not jump. */}
      <span className="block min-h-[1.5em]">{clock ? clock.text : <span className="text-ink-400">Loading local time…</span>}</span>
      <span className="block text-ink-600">
        {clock?.offset || offset} ({zone})
      </span>
    </>
  );
}
