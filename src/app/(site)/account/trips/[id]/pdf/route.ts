import { getViewer } from "@/lib/community/next/session";
import { isCommunityError } from "@/lib/community/errors";
import { planDocument } from "@/lib/planner/document-data";
import { renderPlanPdf } from "@/lib/planner/pdf";

/** The plan as a PDF download. Owner only, paid plans only; never cached or indexed. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" };

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { member } = await getViewer();
  if (!member) return new Response("Please sign in.", { status: 401, headers: HEADERS });
  try {
    const doc = await planDocument(member, id);
    const pdf = await renderPlanPdf(doc);
    const name = `${doc.layout === "visa" ? "proposed-itinerary" : "trip-plan"}-${id.slice(0, 8)}.pdf`;
    return new Response(new Uint8Array(pdf), { headers: { ...HEADERS, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"` } });
  } catch (error) {
    if (isCommunityError(error)) return new Response(error.message, { status: error.code === "not_found" ? 404 : 403, headers: HEADERS });
    console.error("[planner] PDF failed", error instanceof Error ? error.message : error);
    return new Response("The PDF could not be made. Please try again.", { status: 500, headers: HEADERS });
  }
}
