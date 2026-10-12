"use client";

import { useActionState } from "react";

import { startListingCheckoutAction } from "@/lib/community/actions/listings";
import { initialState } from "@/lib/community/next/state";
import { FormMessage, SubmitButton } from "./client";

/** The "Pay" button for a business listing. It opens Stripe's own secure checkout page. */
export function PayListingForm({ id, amount }: { id: string; amount: string }) {
  const [state, action] = useActionState(startListingCheckoutAction, initialState);
  return (
    <form action={action}>
      <FormMessage state={state} />
      <input type="hidden" name="id" value={id} />
      <SubmitButton pendingText="Opening secure payment…">Pay {amount} and send for review</SubmitButton>
    </form>
  );
}
