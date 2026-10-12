import { countLinks } from './text'

/**
 * Automatic checks that decide whether a post or reply can be published straight away, or must
 * wait for a moderator. They never block posting: anything they catch simply goes to the review
 * queue. The reasons are for moderators only; members are never told which check matched, so the
 * checks cannot be learned and worked around.
 */

/** Words that almost only appear in spam on a travel community. Whole words, any case. */
const SPAM_WORDS = [
  'casino', 'gambling', 'betting', 'poker', 'slots', 'jackpot',
  'crypto', 'cryptocurrency', 'bitcoin', 'forex', 'nft', 'airdrop',
  'viagra', 'cialis', 'pharmacy', 'steroids', 'weight loss pills',
  'payday loan', 'loans', 'earn money', 'make money', 'work from home', 'passive income',
  'seo services', 'backlinks', 'guest post', 'buy followers',
  'whatsapp me', 'telegram me', 'dm me', 'click here', 'limited offer', 'promo code', 'discount code',
]
/**
 * Sexual and adult-services words. Travel has honest uses for a few of them (a nude beach, a
 * question about same-sex couples), so a match never blocks: it only asks a person to look first.
 */
const SEXUAL_WORDS = [
  'sex', 'sexy', 'sexual', 'sexually', 'porn', 'porno', 'pornography', 'xxx', 'nsfw',
  'nude', 'nudes', 'nudity', 'naked', 'erotic', 'fetish', 'hookup', 'hook up', 'one night stand',
  'escort', 'escorts', 'call girl', 'call girls', 'prostitute', 'prostitutes', 'prostitution', 'brothel', 'brothels',
  'strip club', 'stripper', 'strippers', 'happy ending', 'onlyfans', 'camgirl', 'cam girls', 'adult dating', 'sugar daddy',
]

const wordPattern = (words: string[]) =>
  new RegExp(`\\b(?:${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')).join('|')})\\b`, 'i')
const SPAM_WORD_PATTERN = wordPattern(SPAM_WORDS)
const SEXUAL_WORD_PATTERN = wordPattern(SEXUAL_WORDS)

/** An email address. */
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/
/** Digits with spaces, dots, dashes or brackets between them. Counted below so dates and prices do not match. */
const DIGIT_RUN = /\+?\d[\d\s().-]{6,}\d/g

/** A phone number has 9 to 15 digits. A date (2026-10-12) has 8 and a price far fewer. */
function hasPhoneNumber(text: string): boolean {
  return (text.match(DIGIT_RUN) ?? []).some((run) => {
    const digits = run.replace(/\D/g, '').length
    return digits >= 9 && digits <= 15
  })
}
/** Ten or more of the same character in a row: "!!!!!!!!!!", "aaaaaaaaaa". */
const REPEATED_PATTERN = /(.)\1{9,}/u

export type ReviewReason =
  | 'contains_link'
  | 'contact_details'
  | 'spam_words'
  | 'sexual_content'
  | 'shouting'
  | 'repeated_characters'

export const REVIEW_REASON_LABELS: Record<ReviewReason, string> = {
  contains_link: 'contains a web link',
  contact_details: 'contains an email address or phone number',
  spam_words: 'contains words often used in spam',
  sexual_content: 'contains sexual or adult-services words',
  shouting: 'written mostly in capital letters',
  repeated_characters: 'has long runs of the same character',
}

function mostlyCapitals(text: string): boolean {
  const letters = text.replace(/[^\p{L}]/gu, '')
  const upper = letters.replace(/[^\p{Lu}]/gu, '')
  return letters.length >= 12 && upper.length / letters.length > 0.7
}

/** Why this text should be checked by a person first. An empty list means it looks fine. */
export function reviewReasons(text: { title?: string; body: string }, options: { allowLinks?: boolean } = {}): ReviewReason[] {
  const title = text.title ?? ''
  const all = `${title}\n${text.body}`
  const reasons: ReviewReason[] = []
  if (!options.allowLinks && countLinks(all) > 0) reasons.push('contains_link')
  if (EMAIL_PATTERN.test(all) || hasPhoneNumber(all)) reasons.push('contact_details')
  if (SPAM_WORD_PATTERN.test(all)) reasons.push('spam_words')
  if (SEXUAL_WORD_PATTERN.test(all)) reasons.push('sexual_content')
  if (mostlyCapitals(title) || mostlyCapitals(text.body)) reasons.push('shouting')
  if (REPEATED_PATTERN.test(all)) reasons.push('repeated_characters')
  return reasons
}

export type PublishDecision = { publish: true } | { publish: false; reasons: string[] }

/**
 * Smart publishing: straight away when the member already has enough approved posts or answers
 * (or a moderator marked them as trusted) and the text passes every check. A member's first
 * contributions are always reviewed, so a new account cannot publish spam on its first try.
 */
export function decidePublishing(input: {
  enabled: boolean
  minApproved: number
  member: { trusted: boolean; approvedCount: number }
  text: { title?: string; body: string }
  /** Photos in this post that a moderator has not approved before. */
  newPhotos?: number
}): PublishDecision {
  if (!input.enabled) return { publish: false, reasons: ['automatic publishing is switched off'] }
  const reasons: string[] = []
  if (!input.member.trusted && input.member.approvedCount < input.minApproved) {
    reasons.push(input.minApproved === 1 ? 'first contribution from this member' : `member has fewer than ${input.minApproved} approved contributions`)
  }
  // Text checks cannot see what is in a picture, so new photos are always looked at by a person,
  // except from members a moderator marked as trusted.
  if ((input.newPhotos ?? 0) > 0 && !input.member.trusted) reasons.push('has new photos')
  // Members a moderator marked as trusted may share links; everyone else's links are checked.
  reasons.push(...reviewReasons(input.text, { allowLinks: input.member.trusted }).map((r) => REVIEW_REASON_LABELS[r]))
  return reasons.length ? { publish: false, reasons } : { publish: true }
}
