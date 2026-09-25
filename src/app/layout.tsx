import type { Metadata } from "next";
import localFont from "next/font/local";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

// Self-hosted variable fonts (SIL Open Font License) — no request to Google at runtime.
const fraunces = localFont({
  src: [
    { path: "../fonts/fraunces-latin-full-normal.woff2", style: "normal", weight: "100 900" },
    { path: "../fonts/fraunces-latin-full-italic.woff2", style: "italic", weight: "100 900" },
  ],
  variable: "--font-fraunces",
  display: "swap",
});
const inter = localFont({
  src: [{ path: "../fonts/inter-latin-standard-normal.woff2", style: "normal", weight: "100 900" }],
  variable: "--font-inter",
  display: "swap",
});

// Set NEXT_PUBLIC_SITE_URL to the production origin before launch (plan §6: canonicals never come from the request host).
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Travel Notes", template: "%s | Travel Notes" },
  description: "Destination guides, itineraries and honest gear reviews.",
  robots: process.env.NEXT_PUBLIC_INDEXABLE === "true" ? undefined : { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
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
