/**
 * SAMPLE CONTENT ONLY.
 * These entries exist so the templates can be reviewed before Payload CMS
 * is connected. Nothing here is real editorial content or real travel advice.
 * Replace via the content repository in src/lib/content once the CMS lands.
 */

import media from "./data/sample-media.json";

export type ArticleType = "Destination guide" | "Itinerary" | "Practical advice" | "Gear review" | "Sponsored feature";

/** A Wikimedia Commons photo used as SAMPLE imagery, shown with its author credit. Replace with original photography. */
export type CommonsImage = { file: string; author: string; license: string; licenseUrl: string; alt: string };

/** Image and destination data live in data/sample-media.json; images reference a license key there. */
type ImageKey = keyof typeof media.images;
type LicenseKey = keyof typeof media.licenses;

const toImage = ({ license, ...rest }: (typeof media.images)[ImageKey]): CommonsImage => ({ ...rest, ...media.licenses[license as LicenseKey] });

export const IMAGES = Object.fromEntries(
  Object.entries(media.images).map(([key, image]) => [key, toImage(image)]),
) as Record<ImageKey, CommonsImage>;

/** Looks up a sample image by its key in sample-media.json; unknown keys fail at build time, not on the page. */
export const sampleImage = (key: string): CommonsImage => {
  if (!(key in IMAGES)) throw new Error(`Unknown sample image "${key}" in src/content/data`);
  return IMAGES[key as ImageKey];
};

export type Stop = { time: string; name: string; note: string };
export type Day = { number: number; title: string; stops: Stop[] };

export type Article = {
  slug: string;
  type: ArticleType;
  title: string;
  deck: string;
  excerpt: string;
  author: { name: string; slug: string };
  readMinutes: number;
  firstPublished: string; // ISO
  updated: string; // ISO
  destination: { name: string; path: string[] }; // e.g. ["japan","kyoto"]
  accent: string; // destination signature colour
  sponsoredBy?: string;
  takeaways: string[];
  heroAlt: string;
  heroTone: string; // fallback gradient when no image
  image?: CommonsImage;
  body: { heading: string; paragraphs: string[] }[];
  days?: Day[];
};

const kyotoBody = [
  { heading: "Getting there and around", paragraphs: [
    "Sample paragraph. This text stands in for an editor-written section so the article template can be reviewed at a realistic length. It is not travel advice.",
    "A second sample paragraph keeps the rhythm of a real guide: a sentence of context, a practical detail, and a short sentence to close.",
  ]},
  { heading: "Where to stay", paragraphs: [
    "Sample paragraph about neighbourhoods. Real articles will name specific areas, explain trade-offs, and link to the destination hub.",
  ]},
  { heading: "What it costs", paragraphs: [
    "Sample paragraph. Prices, opening hours and transport details go through the content review queue described in the implementation plan before publication.",
  ]},
];

export const articles: Article[] = [
  {
    slug: "three-slow-days-in-kyoto",
    type: "Itinerary",
    title: "Three slow days in Kyoto without a car",
    deck: "Temples early, tea houses late, and the train timings that make it work.",
    excerpt: "Temples early, tea houses late, and the train timings that make it work.",
    author: { name: "Sample Author", slug: "sample-author" },
    readMinutes: 9,
    firstPublished: "2026-08-20",
    updated: "2026-09-12",
    destination: { name: "Kyoto", path: ["japan", "kyoto"] },
    accent: "#2e4a50",
    takeaways: [
      "Sample takeaway one — editors write three to five of these per article.",
      "Sample takeaway two — short, specific, no marketing language.",
      "Sample takeaway three.",
    ],
    heroAlt: "Placeholder image standing in for a Kyoto photograph",
    heroTone: "linear-gradient(135deg,#8fa9a6,#4e6f74 55%,#2e4a50)",
    image: IMAGES.kyoto,
    body: kyotoBody,
    days: [
      { number: 1, title: "Higashiyama on foot", stops: [
        { time: "07:30", name: "Sample stop", note: "Sample note explaining why this time." },
        { time: "10:00", name: "Sample stop", note: "Sample note." },
        { time: "13:00", name: "Sample lunch", note: "Sample note." },
      ]},
      { number: 2, title: "Arashiyama and the bamboo grove", stops: [
        { time: "07:30", name: "Sample stop", note: "Sample note." },
        { time: "11:00", name: "Sample stop", note: "Sample note." },
      ]},
      { number: 3, title: "Fushimi and the north", stops: [
        { time: "08:00", name: "Sample stop", note: "Sample note." },
        { time: "12:30", name: "Sample stop", note: "Sample note." },
      ]},
    ],
  },
  {
    slug: "the-carry-on-we-kept-for-a-year",
    type: "Gear review",
    title: "The carry-on we actually kept for a year",
    deck: "Tested on 14 flights and one very wet bus. Here is what wore out first.",
    excerpt: "Tested on 14 flights and one very wet bus. Here is what wore out first.",
    author: { name: "Sample Author", slug: "sample-author" },
    readMinutes: 6,
    firstPublished: "2026-07-02",
    updated: "2026-09-03",
    destination: { name: "Tasmania", path: ["australia", "tasmania"] },
    accent: "#244a5e",
    takeaways: ["Sample takeaway.", "Sample takeaway.", "Sample takeaway."],
    heroAlt: "Product photography pending — placeholder",
    heroTone: "linear-gradient(135deg,#c9a97a,#8a5a2b 60%,#4d3016)",
    body: [
      { heading: "How we tested", paragraphs: ["Sample methodology paragraph. Gear reviews always state how the product was used before any verdict."] },
      { heading: "Verdict", paragraphs: ["Sample verdict paragraph."] },
    ],
  },
  {
    slug: "a-weekend-on-the-great-ocean-road",
    type: "Sponsored feature",
    title: "A weekend on the Great Ocean Road",
    deck: "Where we stopped, stayed and ate on a partner-supported trip.",
    excerpt: "Where we stopped, stayed and ate on a partner-supported trip.",
    author: { name: "Sample Author", slug: "sample-author" },
    readMinutes: 5,
    firstPublished: "2026-09-01",
    updated: "2026-09-01",
    destination: { name: "Tasmania", path: ["australia", "tasmania"] },
    accent: "#2f4a34",
    sponsoredBy: "Sample Partner",
    takeaways: ["Sample takeaway.", "Sample takeaway."],
    heroAlt: "Placeholder image standing in for a coastal photograph",
    heroTone: "linear-gradient(135deg,#a8b8a0,#5d7a5a 60%,#2f4a34)",
    image: IMAGES.greatOceanRoad,
    body: [{ heading: "The drive", paragraphs: ["Sample paragraph. The disclosure banner above the hero is rendered automatically whenever sponsoredBy is set."] }],
  },
];

export const getArticle = (slug: string) => articles.find((a) => a.slug === slug);
