/**
 * SAMPLE CONTENT ONLY.
 * These entries exist so the templates can be reviewed before Payload CMS
 * is connected. Nothing here is real editorial content or real travel advice.
 * Replace via the content repository in src/lib/content once the CMS lands.
 */

export type ArticleType = "Destination guide" | "Itinerary" | "Practical advice" | "Gear review" | "Sponsored feature";

/** A Wikimedia Commons photo used as SAMPLE imagery, shown with its author credit. Replace with original photography. */
export type CommonsImage = { file: string; author: string; license: string; licenseUrl: string; alt: string };

export const CC_BY_SA_4 = { license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" };
export const CC_BY_SA_3 = { license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/" };

export const IMAGES = {
  kyoto: { file: "Fushimi Inari Taisha Torii 17.jpg", author: "Immanuelle", ...CC_BY_SA_4, alt: "Vermilion torii gates lining a path at Fushimi Inari shrine, Kyoto" },
  marrakech: { file: "PLACE Jamaa Lafna MARRAKECH 2.JPEG", author: "Viault", ...CC_BY_SA_3, alt: "Jemaa el-Fnaa square in Marrakech, crowded with stalls and people" },
  tasmania: { file: "Boat shed and Cradle Mountain at Dove Lake, Tas.jpg", author: "Thennicke", ...CC_BY_SA_4, alt: "Boat shed on Dove Lake with Cradle Mountain behind, Tasmania" },
  lisbon: { file: "Carris tram 28 Lisbon 2.jpg", author: "Steven Lek", ...CC_BY_SA_4, alt: "Yellow tram 28 on a steep street in Lisbon" },
  hoian: { file: "Hội An, Ancient Town, 2020-01 CN-06.jpg", author: "Steffen Schmitz", ...CC_BY_SA_4, alt: "Lantern-hung shophouses in Hoi An Ancient Town" },
  queenstown: { file: "Lake Wakatipu & Remarkable Mountains.jpg", author: "Donaldytong", ...CC_BY_SA_3, alt: "Lake Wakatipu with the Remarkables mountain range, Queenstown" },
  greatOceanRoad: { file: "The Twelve Apostles, Victoria, June 2017.jpg", author: "Ruhseal", ...CC_BY_SA_4, alt: "Limestone stacks of the Twelve Apostles on the Great Ocean Road" },
} satisfies Record<string, CommonsImage>;

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
  sponsoredBy?: string;
  takeaways: string[];
  heroAlt: string;
  heroTone: string; // fallback gradient when no image
  image?: CommonsImage;
  body: { heading: string; paragraphs: string[] }[];
  days?: Day[];
};

export type Destination = { name: string; parent: string; slug: string; guides: number; tone: string; alt: string; image?: CommonsImage };

export const destinations: Destination[] = [
  { name: "Kyoto", parent: "Japan", slug: "japan/kyoto", guides: 3, tone: "linear-gradient(135deg,#8fa9a6,#4e6f74 55%,#2e4a50)", alt: "Placeholder for Kyoto photography", image: IMAGES.kyoto },
  { name: "Marrakech", parent: "Morocco", slug: "morocco/marrakech", guides: 2, tone: "linear-gradient(135deg,#d6a56a,#a25d2a 60%,#5d2e0f)", alt: "Placeholder for Marrakech photography", image: IMAGES.marrakech },
  { name: "Tasmania", parent: "Australia", slug: "australia/tasmania", guides: 2, tone: "linear-gradient(135deg,#9fc3d6,#4f7f9a 60%,#244a5e)", alt: "Placeholder for Tasmania photography", image: IMAGES.tasmania },
  { name: "Lisbon", parent: "Portugal", slug: "portugal/lisbon", guides: 1, tone: "linear-gradient(135deg,#e6c9a8,#c27a4b 60%,#7a3f1e)", alt: "Placeholder for Lisbon photography", image: IMAGES.lisbon },
  { name: "Hoi An", parent: "Vietnam", slug: "vietnam/hoi-an", guides: 1, tone: "linear-gradient(135deg,#e9d38a,#b58a2a 60%,#5e4410)", alt: "Placeholder for Hoi An photography", image: IMAGES.hoian },
  { name: "Queenstown", parent: "New Zealand", slug: "new-zealand/queenstown", guides: 1, tone: "linear-gradient(135deg,#b8c8d8,#5f7e9c 60%,#2b4560)", alt: "Placeholder for Queenstown photography", image: IMAGES.queenstown },
];

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
    sponsoredBy: "Sample Partner",
    takeaways: ["Sample takeaway.", "Sample takeaway."],
    heroAlt: "Placeholder image standing in for a coastal photograph",
    heroTone: "linear-gradient(135deg,#a8b8a0,#5d7a5a 60%,#2f4a34)",
    image: IMAGES.greatOceanRoad,
    body: [{ heading: "The drive", paragraphs: ["Sample paragraph. The disclosure banner above the hero is rendered automatically whenever sponsoredBy is set."] }],
  },
];

export const getArticle = (slug: string) => articles.find((a) => a.slug === slug);
