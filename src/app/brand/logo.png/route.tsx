import { ImageResponse } from "next/og";

/**
 * The Travel Notes wordmark as a PNG (600 × 120), used as the publisher logo in structured data.
 * Search engines need an image they can fetch; the header wordmark itself is styled text.
 */
export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff", color: "#0e2a3d", fontSize: 72, fontWeight: 700 }}>
        Travel<span style={{ color: "#1f6f63", fontStyle: "italic", fontWeight: 400, marginLeft: 10 }}>Notes</span>
      </div>
    ),
    { width: 600, height: 120, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
