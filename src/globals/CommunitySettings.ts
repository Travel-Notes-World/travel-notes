import type { GlobalConfig } from 'payload'

import { hasRole } from '../access/roles'

/**
 * Community switches and the search-indexing quality policy.
 * Administrators only. Every change is kept in the version history, so the policy is auditable.
 *
 * Both main switches start OFF. A fresh deployment shows no community pages to the public and
 * accepts no sign-ups until an administrator turns them on.
 */
export const CommunitySettings: GlobalConfig = {
  slug: 'community-settings',
  label: 'Community settings',
  admin: { group: 'Administration' },
  access: { read: ({ req }) => hasRole(req, 'contributor'), update: ({ req }) => hasRole(req, 'administrator'), readVersions: ({ req }) => hasRole(req, 'administrator') },
  versions: { max: 100 },
  fields: [
    { name: 'publicAccess', type: 'checkbox', defaultValue: false, admin: { description: 'ON: everyone can read approved community pages. OFF: only signed-in staff can see them.' } },
    { name: 'signupsOpen', type: 'checkbox', defaultValue: false, admin: { description: 'ON: new members can sign up. Needs working email, because every new account must confirm its address.' } },
    { name: 'submissionsOpen', type: 'checkbox', defaultValue: true, admin: { description: 'OFF: members can read but cannot post, reply or upload. Use it during an incident.' } },
    { name: 'maxPendingPerMember', type: 'number', defaultValue: 5, min: 1, max: 50, admin: { description: 'How many contributions one member can have waiting for review at once.' } },
    {
      name: 'indexing',
      type: 'group',
      label: 'Search-engine quality policy',
      admin: { description: 'Approval makes a page public. This policy decides separately whether search engines may index it. A moderator can override it per page.' },
      fields: [
        { name: 'questionsAuto', type: 'checkbox', defaultValue: true, admin: { description: 'ON: a question becomes indexable once it has enough approved answers. OFF: every question needs a moderator decision.' } },
        { name: 'activitiesAuto', type: 'checkbox', defaultValue: true, admin: { description: 'ON: a published activity (always checked by a moderator) is indexable until 30 days after it ends. OFF: every activity needs an administrator decision.' } },
        { name: 'questionMinAnswers', type: 'number', defaultValue: 1, min: 1, max: 10, admin: { description: 'Approved answers needed before a question is indexable.' } },
        { name: 'profileMinPublished', type: 'number', defaultValue: 2, min: 1, max: 50, admin: { description: 'Approved contributions or answers a member needs before their public profile is indexable.' } },
      ],
    },
    {
      name: 'listings',
      type: 'group',
      label: 'Paid business listings',
      admin: {
        description:
          'A fee for commercial activities (tours, classes, paid experiences run by a business). Member meet-ups and public events stay free. Payments are taken by Stripe and only work once the STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET settings are added in Vercel and the seller details below are filled in. Until then, business listings are free.',
      },
      fields: [
        { name: 'enabled', type: 'checkbox', defaultValue: false, label: 'Charge for business listings' },
        { name: 'feeAud', type: 'number', defaultValue: 5, min: 0, max: 1000, label: 'Price per listing (AUD, including GST)' },
        { name: 'priceLabel', type: 'text', defaultValue: 'Launch price', maxLength: 40, label: 'Price label', admin: { description: 'Shown next to the price, for example “Launch price”. Never show an earlier price that was not really charged.' } },
        { name: 'gstRegistered', type: 'checkbox', defaultValue: true, label: 'The seller is registered for GST', admin: { description: 'ON: invoices are “Tax invoice” and show the GST included (1/11 of the price). OFF: a receipt with no GST.' } },
        { name: 'sellerName', type: 'text', maxLength: 120, label: 'Seller legal name', admin: { description: 'The person or entity that receives the money and is named on invoices. Check with your accountant.' } },
        {
          name: 'sellerAbn',
          type: 'text',
          maxLength: 14,
          label: 'Seller ABN',
          validate: (value: unknown) => {
            if (!value) return true
            const digits = String(value).replace(/\s/g, '')
            if (!/^\d{11}$/.test(digits)) return 'An ABN has 11 digits.'
            const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
            const sum = digits.split('').reduce((total, d, i) => total + (Number(d) - (i === 0 ? 1 : 0)) * weights[i], 0)
            return sum % 89 === 0 ? true : 'This is not a valid ABN. Please check the number.'
          },
        },
      ],
    },
    {
      name: 'review',
      type: 'group',
      label: 'Review rules',
      fields: [
        {
          name: 'smartPublish',
          type: 'checkbox',
          defaultValue: true,
          label: 'Smart publishing',
          admin: {
            description:
              'ON (recommended): questions, trip reports, answers and replies go live straight away when the member already has approved contributions and the automatic spam checks pass (no links, phone numbers, email addresses, spam words or shouting). Everything else waits in the review queue. Activities are always reviewed. Turn OFF during a spam attack to review everything.',
          },
        },
        {
          name: 'smartPublishMinApproved',
          type: 'number',
          defaultValue: 1,
          min: 1,
          max: 20,
          label: 'Approved contributions needed first',
          admin: { description: 'How many of a member’s posts or answers a moderator must approve before their next ones can go live straight away.' },
        },
        {
          name: 'autoHideReports',
          type: 'number',
          defaultValue: 3,
          min: 2,
          max: 20,
          label: 'Hide after this many reports',
          admin: { description: 'A published post or reply reported by this many different members is hidden until a moderator checks it.' },
        },
        { name: 'autoApproveTrustedReplies', type: 'checkbox', defaultValue: false, admin: { description: 'OFF (recommended at launch): every reply is reviewed. ON: replies from members a moderator marked as trusted are published straight away and logged. Members are never marked trusted automatically.' } },
      ],
    },
    {
      name: 'planner',
      type: 'group',
      label: 'AI Trip Planner',
      admin: {
        description:
          'AI fills in the days of a saved plan, using Travel Notes content first. It only works when the ANTHROPIC_API_KEY setting is added in Vercel and the switch below is ON. Each member’s first brief AI plan is free. A detailed plan (more detail, revisions, sharing, PDF and print) is paid once per plan through Stripe (the seller details in "Paid business listings" are used on the invoice).',
      },
      fields: [
        { name: 'aiEnabled', type: 'checkbox', defaultValue: false, label: 'Turn on AI plans' },
        {
          name: 'model',
          type: 'select',
          defaultValue: 'claude-sonnet-5-5',
          options: [
            { value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (better plans)' },
            { value: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (cheapest)' },
          ],
        },
        { name: 'dailyBudgetUsd', type: 'number', defaultValue: 5, min: 0.5, max: 500, label: 'Daily AI spending limit (US dollars)', admin: { description: 'When the estimated AI cost for the day (Sydney time) reaches this, AI plans pause until midnight. The normal planner keeps working.' } },
        { name: 'freePlans', type: 'number', defaultValue: 1, min: 0, max: 20, label: 'Free brief AI plans per member' },
        { name: 'priceAud', type: 'number', defaultValue: 9.99, min: 0, max: 500, label: 'Price per detailed plan (AUD, including GST)', admin: { description: 'One payment covers one plan: the detailed AI plan, revisions, a share link, and the PDF and print version.' } },
        { name: 'revisionsPerPlan', type: 'number', defaultValue: 5, min: 0, max: 20, label: 'AI revisions included in a paid plan' },
      ],
    },
  ],
}
