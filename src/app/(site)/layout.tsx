import type { Metadata } from "next";
import localFont from "next/font/local";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "../globals.css";

// Self-hosted variable fonts (SIL Open Font License, via Fontsource) — no request to Google at runtime.
const newsreader = localFont({
  src: [
    { path: "../../fonts/newsreader-latin-standard-normal.woff2", style: "normal", weight: "200 800" },
    { path: "../../fonts/newsreader-latin-standard-italic.woff2", style: "italic", weight: "200 800" },
  ],
  variable: "--font-newsreader",
  display: "swap",
});
const instrumentSans = localFont({
  src: [{ path: "../../fonts/instrument-sans-latin-standard-normal.woff2", style: "normal", weight: "400 700" }],
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
    <html lang="en" className={`${newsreader.variable} ${instrumentSans.variable}`}>
      <body>
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
