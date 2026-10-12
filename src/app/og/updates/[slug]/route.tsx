import { ImageResponse } from "next/og";

import { getUpdate } from "@/lib/content/updates";

/**
 * The share image for one travel update (1200 × 630) at a stable address, /og/updates/<slug>:
 * used by social networks and messaging apps (og:image, twitter:image) and as the article image
 * in the page's structured data. Built from the update's own title, category and date, so it
 * never shows anything the page does not.
 */
export const revalidate = 3600;
const size = { width: 1200, height: 630 };

const date = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Sydney" });

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const u = await getUpdate((await params).slug);
  const title = u?.title ?? "Travel update";
  const fontSize = title.length > 90 ? 52 : title.length > 60 ? 60 : 68;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f7f3ea", padding: "64px 72px", color: "#0e2a3d" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>
            Travel<span style={{ color: "#1f6f63", fontStyle: "italic", fontWeight: 400, marginLeft: 6 }}>Notes</span>
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#7d6217", textTransform: "uppercase", letterSpacing: 3 }}>{u ? u.categoryLabel : "Travel updates"}</div>
        </div>
        <div style={{ display: "flex", fontSize, fontWeight: 700, lineHeight: 1.15 }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 28, color: "#4a5a66" }}>
          <div style={{ display: "flex" }}>{u ? `${u.updated ? "Updated" : "Published"} ${date(u.updated ?? u.firstPublished)}` : "travelnotesworld.com"}</div>
          {u?.affectsAustralians ? <div style={{ display: "flex", background: "#0e2a3d", color: "#f7f3ea", padding: "6px 16px", borderRadius: 8, fontSize: 24 }}>Affects Australian travellers</div> : null}
        </div>
      </div>
    ),
    { ...size, headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } },
  );
}
