import { getViewer } from "@/lib/community/next/session";
import { renderTripPdf } from "@/lib/planner/trip/pdf";
import { findTrip, tripPage } from "@/lib/planner/trip/store";

/** The full trip as a PDF. Paid trips only, checked on the server; never cached or indexed. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" };

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const trip = await findTrip(token);
  if (!trip) return new Response("This trip could not be found.", { status: 404, headers: HEADERS });
  const { member } = await getViewer();
  const page = tripPage(trip, member?.id ?? null);
  if (page.state !== "ready") return new Response("This trip is not ready yet.", { status: 409, headers: HEADERS });
  if (!page.full) return new Response(trip.unlocked ? "Sign in to the account that paid for this trip to download it." : "Unlock this trip to download the PDF.", { status: 403, headers: HEADERS });
  try {
    const pdf = await renderTripPdf(trip.form, page.view);
    const name = `trip-${trip.form.destination.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}-${trip.form.arrive}.pdf`;
    return new Response(new Uint8Array(pdf), { headers: { ...HEADERS, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"` } });
  } catch (error) {
    console.error("[trip planner] PDF failed", error instanceof Error ? error.message : error);
    return new Response("The PDF could not be made. Please try again.", { status: 500, headers: HEADERS });
  }
}
