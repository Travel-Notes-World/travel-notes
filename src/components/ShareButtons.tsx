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

const NETWORKS: { name: string; icon: Icon | null; href: (url: string, title: string) => string }[] = [
  { name: "Facebook", icon: siFacebook, href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${enc(u)}` },
  { name: "X", icon: siX, href: (u, t) => `https://x.com/intent/tweet?url=${enc(u)}&text=${enc(t)}` },
  { name: "WhatsApp", icon: siWhatsapp, href: (u, t) => `https://wa.me/?text=${enc(`${t} ${u}`)}` },
  { name: "LinkedIn", icon: null, href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${enc(u)}` },
  { name: "Reddit", icon: siReddit, href: (u, t) => `https://www.reddit.com/submit?url=${enc(u)}&title=${enc(t)}` },
  { name: "Telegram", icon: siTelegram, href: (u, t) => `https://t.me/share/url?url=${enc(u)}&text=${enc(t)}` },
  { name: "Bluesky", icon: siBluesky, href: (u, t) => `https://bsky.app/intent/compose?text=${enc(`${t} ${u}`)}` },
];

const enc = encodeURIComponent;

const buttonClass =
  "inline-flex items-center justify-center gap-2 min-h-11 min-w-11 px-3 rounded-md border border-line-500 bg-paper-000 text-ink-900 t-ui no-underline hover:border-ink-900 focus-visible:outline-2";

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
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the phone share sheet exists only in some browsers, known after hydration
  useEffect(() => setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  };

  return (
    <section aria-labelledby="share-heading" className="mt-8 max-w-measure">
      <h2 id="share-heading" className="t-meta text-ink-600 m-0">{heading}</h2>
      <ul className="list-none m-0 mt-3 p-0 flex flex-wrap gap-2">
        {canShare && (
          <li>
            <button type="button" className={buttonClass} onClick={() => navigator.share({ title, url }).catch(() => undefined)}>
              <BrandIcon icon={null} /> Share…
            </button>
          </li>
        )}
        {NETWORKS.map((n) => (
          <li key={n.name}>
            <a href={n.href(url, title)} target="_blank" rel="noopener noreferrer" className={buttonClass} title={`Share on ${n.name}`}>
              <BrandIcon icon={n.icon} />
              <span>{n.name}</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
        <li>
          <a href={`mailto:?subject=${enc(title)}&body=${enc(`${title}\n\n${url}`)}`} className={buttonClass}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
            Email
          </a>
        </li>
        <li>
          <button type="button" className={buttonClass} onClick={copy}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
            {copied ? "Link copied" : "Copy link"}
          </button>
        </li>
      </ul>
      <p role="status" aria-live="polite" className="sr-only">{copied ? "Link copied to your clipboard." : ""}</p>
    </section>
  );
}
