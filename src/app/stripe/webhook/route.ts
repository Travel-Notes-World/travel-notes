import { confirmListingPayment, expireListingCheckout } from "@/lib/community/listings";
import { gateway, stripeConfigured } from "@/lib/community/payments/stripe";

/**
 * Stripe webhook for paid business listings. Set it up in Stripe → Developers → Webhooks with the
 * address https://<site>/stripe/webhook and the events:
 *   checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.expired
 * Its signing secret goes in the STRIPE_WEBHOOK_SECRET setting.
 *
 * Every event is checked against that secret, so nobody else can mark a listing as paid. Handling
 * is idempotent: Stripe may send the same event more than once, and the browser's return page
 * records the same payment too.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!stripeConfigured()) return new Response("Payments are not set up.", { status: 503, headers: NO_STORE });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature.", { status: 400, headers: NO_STORE });
  const body = await request.text();
  let event;
  try {
    event = gateway().verifyWebhook(body, signature);
  } catch {
    return new Response("Invalid signature.", { status: 400, headers: NO_STORE });
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      await confirmListingPayment((event.data.object as { id: string }).id);
    } else if (event.type === "checkout.session.expired") {
      await expireListingCheckout((event.data.object as { id: string }).id);
    }
  } catch (error) {
    // A 500 makes Stripe retry later, which is what we want for a temporary database problem.
    console.error("[stripe] webhook handling failed", error instanceof Error ? error.message : error);
    return new Response("Could not record the event. Stripe will retry.", { status: 500, headers: NO_STORE });
  }
  return Response.json({ received: true }, { headers: NO_STORE });
}
