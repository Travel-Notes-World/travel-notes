"use client";

import { useState } from "react";

type Kind = "country" | "region" | "city" | "area";

/** How much of the map to show around the point, in degrees of latitude. */
const SPAN: Record<Kind, number> = { country: 7, region: 2.5, city: 0.12, area: 0.4 };
const ZOOM: Record<Kind, number> = { country: 5, region: 7, city: 12, area: 10 };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const coord = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? pos : neg}`;

/**
 * Where a destination is. Nothing is loaded from OpenStreetMap until the reader asks for the map,
 * so the page stays fast and no third party sees the visit. The "Open in OpenStreetMap" link works
 * without JavaScript.
 */
export function LocationMap({ name, latitude, longitude, kind, source }: { name: string; latitude: number; longitude: number; kind: Kind; source?: string | null }) {
  const [shown, setShown] = useState(false);
  const d = SPAN[kind] ?? 1;
  const bbox = [clamp(longitude - d * 1.6, -180, 180), clamp(latitude - d, -85, 85), clamp(longitude + d * 1.6, -180, 180), clamp(latitude + d, -85, 85)]
    .map((n) => n.toFixed(4))
    .join(",");
  const embed = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  const open = `https://www.openstreetmap.org/?mlat=${latitude.toFixed(5)}&mlon=${longitude.toFixed(5)}#map=${ZOOM[kind] ?? 8}/${latitude.toFixed(4)}/${longitude.toFixed(4)}`;

  return (
    <section aria-labelledby="map-heading" className="rounded-lg border border-paper-200 bg-paper-000 overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h2 id="map-heading" className="t-heading-3 m-0">Where {name} is</h2>
        <p className="t-meta text-ink-400 m-0 mt-1 font-normal tracking-normal">{coord(latitude, "N", "S")}, {coord(longitude, "E", "W")}</p>
      </div>
      <div className="relative aspect-[4/3] bg-paper-100 border-y border-paper-200">
        {shown ? (
          <iframe title={`Map of ${name} from OpenStreetMap`} src={embed} className="absolute inset-0 w-full h-full border-0" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6 text-center bg-[radial-gradient(circle_at_center,var(--color-marine-100)_0,transparent_70%)]">
            <div>
              <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mx-auto text-marine-600">
                <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
                <circle cx="12" cy="9.5" r="2.5" />
              </svg>
              <button type="button" onClick={() => setShown(true)} className="mt-3 inline-flex items-center justify-center min-h-11 px-4 rounded-md bg-navy-900 text-white t-ui hover:bg-marine-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marine-600">
                Show map
              </button>
              <p className="t-meta text-ink-600 m-0 mt-2 font-normal tracking-normal">Loads a map from OpenStreetMap.</p>
            </div>
          </div>
        )}
      </div>
      <p className="t-body-sm m-0 px-5 py-3">
        <a href={open} className="inline-flex items-center min-h-11 text-marine-600 underline">Open in OpenStreetMap</a>
        <span className="block t-meta text-ink-400 font-normal tracking-normal">Map data © OpenStreetMap contributors. Location is approximate{source === "GeoNames" ? <>, from <a href="https://www.geonames.org/" className="underline">GeoNames</a> (CC BY 4.0)</> : null}.</span>
      </p>
    </section>
  );
}
