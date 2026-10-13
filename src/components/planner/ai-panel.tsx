"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormMessage, SubmitButton } from "@/components/community/client";
import { initialState } from "@/lib/community/next/state";
import { generateAiPlanAction, payForAiPlanAction } from "@/lib/planner/ai-actions";

export type AiPanelStatus = {
  available: boolean;
  reason: string | null;
  freeLeft: number;
  paidCredit: boolean;
  priceText: string;
  canPay: boolean;
  generated: boolean;
  tooLong: boolean;
  hasPlaces: boolean;
  maxDays: number;
};

/**
 * "Fill my days with AI". Uses a paid credit for this plan first, then the free allowance; when
 * neither is left it offers to pay for the plan. The request takes up to a minute, so the button
 * says so while it works.
 */
export function AiPanel({ id, status }: { id: string; status: AiPanelStatus }) {
  const [genState, generate] = useActionState(generateAiPlanAction, initialState);
  const [payState, pay] = useActionState(payForAiPlanAction, initialState);
  const canGenerate = status.available && status.hasPlaces && !status.tooLong && (status.paidCredit || status.freeLeft > 0);
  const label = status.generated ? "Write the AI days again" : "Fill my days with AI";

  return (
    <section aria-labelledby="ai-heading" className="mb-8 max-w-[860px] border border-marine-600 rounded-md p-4 bg-paper-000 print:hidden">
      <h2 id="ai-heading" className="t-heading-3 m-0">AI helper</h2>
      <p className="t-body-sm mt-2 mb-0">
        The AI suggests stops for each day, using Travel Notes guides, trip reports and travel updates first. Stops it adds on its own are marked “AI idea”: Travel Notes has not checked them. Your own stops are kept; earlier AI stops are replaced.
      </p>
      <FormMessage state={genState} successTitle="Your plan is filled in" />
      <FormMessage state={payState} />

      {!status.hasPlaces ? (
        <p className="t-body-sm text-ink-600 mt-3 mb-0">This plan was not started in the Trip Planner, so the AI does not know where you are going. Start a new plan from the <Link href="/trip-planner" className="text-marine-600 underline">Trip Planner</Link>.</p>
      ) : !status.available ? (
        <p className="t-body-sm text-ink-600 mt-3 mb-0">{status.reason}</p>
      ) : status.tooLong ? (
        <p className="t-body-sm text-ink-600 mt-3 mb-0">AI plans cover up to {status.maxDays} days. Remove some days, or split the trip into two plans.</p>
      ) : canGenerate ? (
        <form action={generate} className="mt-4">
          <input type="hidden" name="id" value={id} />
          <SubmitButton pendingText="Writing your plan… this can take up to a minute">
            {label}{status.paidCredit ? "" : " (free)"}
          </SubmitButton>
          <p className="t-body-sm text-ink-600 mt-2 mb-0">
            {status.paidCredit ? "Included in your payment for this plan." : status.freeLeft === 1 ? "This uses your free AI plan." : `You have ${status.freeLeft} free AI plans left.`}
          </p>
        </form>
      ) : status.canPay ? (
        <form action={pay} className="mt-4">
          <input type="hidden" name="id" value={id} />
          <p className="t-body-sm mt-0">You have used your free AI plan. One payment of {status.priceText} (including GST) covers this plan: the AI days and printing it.</p>
          <SubmitButton pendingText="Opening the secure payment page…">Pay {status.priceText} for this plan</SubmitButton>
          <p className="t-body-sm text-ink-600 mt-2 mb-0">You pay on Stripe’s secure page. Travel Notes never sees your card details.</p>
        </form>
      ) : (
        <p className="t-body-sm text-ink-600 mt-3 mb-0">You have used your free AI plan. Paid AI plans are not available yet.</p>
      )}
    </section>
  );
}

/** Pay to unlock printing when the AI part is not what the member needs. */
export function UnlockPrintForm({ id, priceText }: { id: string; priceText: string }) {
  const [state, pay] = useActionState(payForAiPlanAction, initialState);
  return (
    <form action={pay}>
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      <SubmitButton variant="secondary" pendingText="Opening the secure payment page…">Unlock printing: {priceText}</SubmitButton>
    </form>
  );
}
