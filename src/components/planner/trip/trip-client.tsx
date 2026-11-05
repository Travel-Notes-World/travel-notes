"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { FormMessage, SubmitButton } from "@/components/community/client";
import { initialState } from "@/lib/community/next/state";
import { unlockTripAction } from "@/lib/planner/trip/actions";

/** While the trip is being written: show progress and check again every few seconds. */
export function GeneratingPoller({ seconds: start }: { seconds: number }) {
  const router = useRouter();
  const [seconds, setSeconds] = useState(start);
  useEffect(() => {
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    const poll = setInterval(() => router.refresh(), 4000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, [router]);
  const step = seconds < 25 ? "Choosing your route and bases…" : seconds < 70 ? "Planning each day and checking travel times…" : "Looking up current prices and adding up your budget…";
  return (
    <div role="status" aria-live="polite" className="max-w-[720px]">
      <p className="t-ui m-0">{step}</p>
      <p className="t-body-sm text-ink-600 mt-1 mb-4">This usually takes one to two minutes ({seconds} s so far). You can leave this page open; your trip is saved.</p>
      <div className="h-2 rounded-full bg-paper-200 overflow-hidden" aria-hidden="true">
        <div className="h-full bg-marine-600 transition-[width] duration-1000" style={{ width: `${Math.min(95, (seconds / 120) * 100)}%` }} />
      </div>
      <div className="grid gap-3 mt-6" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-md border border-paper-200 p-4 animate-pulse">
            <div className="h-4 w-1/3 rounded bg-paper-200" />
            <div className="h-3 w-5/6 rounded bg-paper-200 mt-3" />
            <div className="h-3 w-2/3 rounded bg-paper-200 mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** "Unlock my full trip + PDF — A$9.99". Signs in first when needed, then opens Stripe's payment page. */
export function UnlockButton({ token, priceText, canPay }: { token: string; priceText: string; canPay: boolean }) {
  const [state, action] = useActionState(unlockTripAction, initialState);
  if (!canPay) return <p className="t-body-sm text-ink-600 m-0">Unlocking is not available at the moment. Your trip is saved: please come back later.</p>;
  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <SubmitButton pendingText="Opening secure payment…" className="inline-flex items-center justify-center min-h-12 px-6 rounded-md bg-ochre-700 text-paper-000 t-ui hover:opacity-90 w-full sm:w-auto">Unlock my full trip + PDF — {priceText}</SubmitButton>
    </form>
  );
}
