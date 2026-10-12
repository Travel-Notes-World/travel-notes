import Stripe from 'stripe'

/**
 * The few Stripe calls the site makes, behind one small interface so tests can replace them.
 * Card details never touch Travel Notes: people pay on Stripe's own checkout page.
 */
export type CheckoutSession = { id: string; url: string | null; paymentStatus: string; paymentIntentId: string | null; customerEmail: string | null; metadata: Record<string, string> }

export type PaymentGateway = {
  createCheckout(input: {
    amountMinor: number
    currency: string
    productName: string
    customerEmail: string | null
    successUrl: string
    cancelUrl: string
    metadata: Record<string, string>
    idempotencyKey: string
  }): Promise<CheckoutSession>
  getCheckout(sessionId: string): Promise<CheckoutSession>
  refund(paymentIntentId: string, idempotencyKey: string): Promise<void>
  /** Check a webhook really came from Stripe. Returns the event, or throws. */
  verifyWebhook(rawBody: string, signature: string): Stripe.Event
}

let override: PaymentGateway | null = null

/** Tests only: use a fake gateway. Pass null to go back to the real one. */
export function setPaymentGatewayForTests(gateway: PaymentGateway | null): void {
  override = gateway
}

export const stripeConfigured = (): boolean => Boolean(override || (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET))

const toSession = (s: Stripe.Checkout.Session): CheckoutSession => ({
  id: s.id,
  url: s.url,
  paymentStatus: s.payment_status,
  paymentIntentId: typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent?.id ?? null),
  customerEmail: s.customer_details?.email ?? s.customer_email ?? null,
  metadata: (s.metadata ?? {}) as Record<string, string>,
})

let client: Stripe | null = null
function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set.')
  client ??= new Stripe(key, { maxNetworkRetries: 2 })
  return client
}

const real: PaymentGateway = {
  async createCheckout(input) {
    const session = await stripe().checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [{ quantity: 1, price_data: { currency: input.currency.toLowerCase(), unit_amount: input.amountMinor, product_data: { name: input.productName } } }],
        ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: input.metadata,
        payment_intent_data: { metadata: input.metadata },
        // An unpaid checkout link stops working after an hour.
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      },
      { idempotencyKey: input.idempotencyKey },
    )
    return toSession(session)
  },
  async getCheckout(sessionId) {
    return toSession(await stripe().checkout.sessions.retrieve(sessionId))
  },
  async refund(paymentIntentId, idempotencyKey) {
    await stripe().refunds.create({ payment_intent: paymentIntentId }, { idempotencyKey })
  },
  verifyWebhook(rawBody, signature) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set.')
    return stripe().webhooks.constructEvent(rawBody, signature, secret)
  },
}

export const gateway = (): PaymentGateway => override ?? real
