import { type JSXConvertersFunction, LinkJSXConverter, RichText } from "@payloadcms/richtext-lexical/react";
import type { ReactNode } from "react";

import type { StoryBody } from "@/lib/content/stories";

type RichData = Extract<StoryBody, { kind: "rich" }>["data"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- link targets are populated CMS documents of several types
const internalDocToHref = ({ linkNode }: { linkNode: any }): string => {
  const { relationTo, value } = linkNode?.fields?.doc ?? {};
  if (!value || typeof value !== "object") return "#";
  if (relationTo === "articles" && value.slug) return `/stories/${value.slug}`;
  if (relationTo === "destinations" && value.path) return `/destinations/${value.path}`;
  if (relationTo === "topics" && value.slug) return `/topics/${value.slug}`;
  if (relationTo === "authors" && value.slug) return `/authors/${value.slug}`;
  return "#";
};

const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,
  ...LinkJSXConverter({ internalDocToHref }),
  // The page title is the only h1, so a body h1 becomes an h2. Anchor ids come from prepareRichBody.
  heading: ({ node, nodesToJSX }) => {
    const children = nodesToJSX({ nodes: node.children });
    const Tag = (node.tag === "h1" ? "h2" : node.tag) as "h2" | "h3" | "h4" | "h5" | "h6";
    const id = (node as { anchorId?: string }).anchorId;
    return <Tag id={id}>{children}</Tag>;
  },
});

/** Renders CMS rich text as server HTML inside the article typography. `afterFirstSection` is placed before the second h2. */
export function RichBody({ data, afterFirstSection }: { data: RichData; afterFirstSection?: ReactNode }) {
  const nodes = data.root?.children ?? [];
  // Split before the second h2 so an in-article slot sits between sections, never inside one.
  let h2Seen = 0;
  let splitAt = -1;
  nodes.forEach((n, i) => {
    const node = n as { type?: string; tag?: string };
    if (splitAt === -1 && node.type === "heading" && (node.tag === "h2" || node.tag === "h1") && ++h2Seen === 2) splitAt = i;
  });
  if (!afterFirstSection || splitAt === -1) {
    return <RichText data={data} converters={converters} disableContainer />;
  }
  const part = (children: typeof nodes) => ({ ...data, root: { ...data.root, children } }) as RichData;
  return (
    <>
      <RichText data={part(nodes.slice(0, splitAt))} converters={converters} disableContainer />
      {afterFirstSection}
      <RichText data={part(nodes.slice(splitAt))} converters={converters} disableContainer />
    </>
  );
}
