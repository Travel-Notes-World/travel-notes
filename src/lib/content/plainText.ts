/**
 * The readable text of a Lexical rich-text value: only the words a reader sees. Node types, format
 * flags, link addresses and other JSON keys are never included. Block nodes (paragraphs, headings,
 * list items, quotes) are separated by a line break so words from two blocks never run together.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Lexical nodes are loosely typed JSON
type LexicalNode = any

/** Upper bound on the text kept for search, far above any real article. */
export const PLAIN_TEXT_MAX = 100_000

const INLINE = new Set(['text', 'link', 'autolink', 'linebreak', 'tab'])

function collect(node: LexicalNode, out: string[]): void {
  if (!node || typeof node !== 'object') return
  if (node.type === 'linebreak') out.push('\n')
  else if (node.type === 'tab') out.push(' ')
  else if (typeof node.text === 'string' && (node.type === 'text' || node.type === undefined)) out.push(node.text)
  if (Array.isArray(node.children)) {
    for (const child of node.children) collect(child, out)
    if (!INLINE.has(node.type)) out.push('\n')
  }
}

export function lexicalPlainText(value: unknown): string {
  const root = (value as { root?: LexicalNode } | null | undefined)?.root
  if (!root) return ''
  const out: string[] = []
  collect(root, out)
  return out
    .join('')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, PLAIN_TEXT_MAX)
}
