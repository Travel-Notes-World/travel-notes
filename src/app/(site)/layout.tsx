import type { Metadata } from "next";
import localFont from "next/font/local";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "../globals.css";

// Self-hosted variable fonts (SIL Open Font License, via Fontsource) — no request to Google at runtime.
// Cut down with fonttools (`varLib.instancer`) to what the site uses, so pages download about 150 KB of fonts
// instead of 330 KB: Newsreader weight 400–700 (optical size kept, so headings at every size look the same),
// Newsreader italic fixed at weight 400 and optical size 24 (it only sets the logo and quotes, at 24–26 px), and
// Instrument Sans weight 400–700 at normal width.
const newsreader = localFont({
  src: [
    { path: "../../fonts/newsreader-latin-wght400-700.woff2", style: "normal", weight: "400 700" },
    { path: "../../fonts/newsreader-latin-italic-wght400.woff2", style: "italic", weight: "400" },
  ],
  variable: "--font-newsreader",
  display: "swap",
});
const instrumentSans = localFont({
  src: [{ path: "../../fonts/instrument-sans-latin-wght400-700.woff2", style: "normal", weight: "400 700" }],
  variable: "--font-instrument",
  display: "swap",
});

import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Travel Notes", template: "%s | Travel Notes" },
  description: "Destination guides, itineraries and honest gear reviews.",
  robots: process.env.NEXT_PUBLIC_INDEXABLE === "true" ? undefined : { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${instrumentSans.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-marine-600 focus:text-on-marine focus:px-4 focus:py-2 focus:rounded-md">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" tabIndex={-1}>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
