"use client";

import { siBluesky, siFacebook, siReddit, siTelegram, siWhatsapp, siX } from "simple-icons";
import { useEffect, useState } from "react";

/**
 * Share a page on social media, by message or by email.
 *
 * Every button is a plain link to the network's own share page: no third-party script, no
 * tracking pixel and no cookie is loaded on Travel Notes, so the privacy and cookie policies stay
 * true. "Copy link" and the phone's own share sheet need JavaScript; the links work without it.
 * Brand icons come from the Simple Icons set (CC0).
 */
type Icon = { title: string; path: string; hex: string };

/** `main`: shown as an icon on phones too. The others sit behind "More" on small screens. */
const NETWORKS: { name: string; icon: Icon | null; main: boolean; href: (url: string, title: string) => string }[] = [
  { name: "WhatsApp", icon: siWhatsapp, main: true, href: (u, t) => `https://wa.me/?text=${enc(`${t} ${u}`)}` },
  { name: "Facebook", icon: siFacebook, main: true, href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${enc(u)}` },
  { name: "X", icon: siX, main: true, href: (u, t) => `https://x.com/intent/tweet?url=${enc(u)}&text=${enc(t)}` },
  { name: "LinkedIn", icon: null, main: false, href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${enc(u)}` },
  { name: "Reddit", icon: siReddit, main: false, href: (u, t) => `https://www.reddit.com/submit?url=${enc(u)}&title=${enc(t)}` },
  { name: "Telegram", icon: siTelegram, main: false, href: (u, t) => `https://t.me/share/url?url=${enc(u)}&text=${enc(t)}` },
  { name: "Bluesky", icon: siBluesky, main: false, href: (u, t) => `https://bsky.app/intent/compose?text=${enc(`${t} ${u}`)}` },
];

const enc = encodeURIComponent;

// Phones: a round 44 px icon button with the name read out to screen readers.
// Larger screens: the icon with its name, as a normal button.
const buttonClass =
  "inline-flex items-center justify-center gap-2 h-11 w-11 sm:w-auto sm:px-3 rounded-full sm:rounded-md border border-line-500 bg-paper-000 text-ink-900 t-ui no-underline hover:border-ink-900 focus-visible:outline-2";
const labelClass = "sr-only sm:not-sr-only";

function BrandIcon({ icon }: { icon: Icon | null }) {
  if (!icon) {
    // A neutral "share" mark where the brand does not allow its logo in open icon sets.
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
      </svg>
    );
  }
  return (
    // The brand's own colour, so each network is recognised at a glance.
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill={`#${icon.hex}`}>
      <path d={icon.path} />
    </svg>
  );
}

export function ShareButtons({ url, title, heading = "Share this update" }: { url: string; title: string; heading?: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [more, setMore] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser features are only known after hydration
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    setEnhanced(true);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  };

  // Without JavaScript every option shows. With it, phones get one tidy row and a "More" button.
  const extraClass = enhanced && !more ? "hidden sm:block" : "";

  return (
    <section aria-labelledby="share-heading" className="mt-8 max-w-measure">
      <h2 id="share-heading" className="t-meta text-ink-600 m-0">{heading}</h2>
      <ul className="list-none m-0 mt-3 p-0 flex flex-wrap items-center gap-1 min-[360px]:gap-2">
        {canShare && (
          <li>
            <button type="button" className={buttonClass} title="Share" onClick={() => navigator.share({ title, url }).catch(() => undefined)}>
              <BrandIcon icon={null} /><span className={labelClass}>Share…</span>
            </button>
          </li>
        )}
        {NETWORKS.map((n) => (
          <li key={n.name} className={n.main ? "" : extraClass}>
            {/* A network without a brand icon always shows its name, so it is never mistaken for the general "Share" button. */}
            <a href={n.href(url, title)} target="_blank" rel="noopener noreferrer" className={n.icon ? buttonClass : `${buttonClass} w-auto px-3`} title={`Share on ${n.name}`}>
              <BrandIcon icon={n.icon} />
              <span className={n.icon ? labelClass : ""}>{n.name}</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
        <li className={extraClass}>
          <a href={`mailto:?subject=${enc(title)}&body=${enc(`${title}\n\n${url}`)}`} className={buttonClass} title="Share by email">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
            <span className={labelClass}>Email</span>
          </a>
        </li>
        <li>
          <button type="button" className={buttonClass} title="Copy link" onClick={copy}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
            <span className={labelClass}>{copied ? "Link copied" : "Copy link"}</span>
          </button>
        </li>
        {enhanced && (
          <li className="sm:hidden">
            <button type="button" className={buttonClass} aria-expanded={more} onClick={() => setMore((m) => !m)} title={more ? "Fewer options" : "More options"}>
              {more ? (
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
              )}
              <span className="sr-only">{more ? "Show fewer sharing options" : "Show more sharing options"}</span>
            </button>
          </li>
        )}
      </ul>
      <p role="status" aria-live="polite" className={copied ? "t-body-sm text-ink-600 mt-2 mb-0 sm:sr-only" : "sr-only"}>{copied ? "Link copied." : ""}</p>
    </section>
  );
}
