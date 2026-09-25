/**
 * Reserved advertising frame. Ads are OFF until the provider adapter and
 * consent controller exist (plan §8). The frame still reserves its height so
 * turning ads on later cannot shift the layout.
 */
const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";

export function AdSlot({ placement }: { placement: string }) {
  if (!ADS_ENABLED) return null;
  return (
    <div className="max-w-measure" data-placement={placement}>
      <p className="t-meta text-ink-400 text-center m-0 mb-2">Advertisement</p>
      <div className="min-h-ad-inline rounded-md border border-dashed border-paper-200" />
    </div>
  );
}
