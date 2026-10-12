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
        { name: 'questionMinAnswers', type: 'number', defaultValue: 1, min: 1, max: 10, admin: { description: 'Approved answers needed before a question is indexable.' } },
        { name: 'profileMinPublished', type: 'number', defaultValue: 2, min: 1, max: 50, admin: { description: 'Approved contributions or answers a member needs before their public profile is indexable.' } },
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
  ],
}
