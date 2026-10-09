/**
 * Staff two-step login (src/access/twoFactor.ts, payload-totp). A staff member who signed in with
 * a password but has not entered a code in this session has no staff rights anywhere: CMS
 * collections, the community moderation rules or the site's staff view. Visitors and members are
 * not affected.
 */
import './two-factor-env'

import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { payload, setup, staff, unique, type Any } from './helpers'

let ROLES: Any, COMMUNITY: Any, TWO: Any, STAFF: Any
const password = (u: Any) => ({ ...u, collection: 'staff', _strategy: 'local-jwt' })
const withCode = (u: Any) => ({ ...u, collection: 'staff', _strategy: 'totp' })
const req = (user: Any) => ({ user, payload }) as Any

before(async () => {
  await setup()
  ROLES = await import('../../src/access/roles')
  COMMUNITY = await import('../../src/access/community')
  TWO = await import('../../src/access/twoFactor')
  STAFF = (await import('../../src/collections/Staff')).Staff
  await payload.update({ collection: 'staff', id: staff.moderator.id, data: { communityModerator: true } as Any })
})
after(async () => { await payload.destroy?.() })

describe('the switch', () => {
  it('is on for this test file, and STAFF_2FA=off is ignored in a production build', () => {
    assert.equal(TWO.staffTwoFactorDisabled(), false)
    const saved = { env: process.env.NODE_ENV, flag: process.env.STAFF_2FA }
    try {
      Object.assign(process.env, { NODE_ENV: 'production', STAFF_2FA: 'off' })
      assert.equal(TWO.staffTwoFactorDisabled(), false)
    } finally {
      const env = process.env as Record<string, string | undefined>
      env.NODE_ENV = saved.env
      env.STAFF_2FA = saved.flag
    }
  })

  it('the plugin is registered on the staff collection, and the secret can never be read', async () => {
    const strategies = payload.collections.staff.config.auth.strategies.map((s: Any) => s.name)
    assert.ok(strategies.includes('totp'), JSON.stringify(strategies))
    const doc = await payload.findByID({ collection: 'staff', id: staff.editor.id, overrideAccess: false, user: withCode(staff.editor) })
    assert.equal('totpSecret' in doc, false)
  })
})

describe('password only: no staff rights yet', () => {
  it('role and moderator checks fail until the code is entered', () => {
    assert.equal(ROLES.hasRole(req(password(staff.editor)), 'contributor'), false)
    assert.equal(ROLES.hasRole(req(withCode(staff.editor)), 'editor'), true)
    assert.equal(COMMUNITY.userCanModerate(password(staff.moderator)), false)
    assert.equal(COMMUNITY.userCanModerate(withCode(staff.moderator)), true)
  })

  it('cannot see drafts, create articles, read contact messages or the community settings', async () => {
    const draft = await payload.create({ collection: 'articles', draft: true, data: { title: unique('Draft '), slug: unique('draft-'), _status: 'draft' } as Any })
    const asPassword = { overrideAccess: false, user: password(staff.editor) }
    const drafts = await payload.find({ collection: 'articles', draft: true, where: { id: { equals: draft.id } }, ...asPassword })
    assert.equal(drafts.docs.length, 0, 'a draft is invisible without the code')
    const withTheCode = await payload.find({ collection: 'articles', draft: true, where: { id: { equals: draft.id } }, overrideAccess: false, user: withCode(staff.editor) })
    assert.equal(withTheCode.docs.length, 1, 'the same editor sees it after entering the code')

    await assert.rejects(payload.create({ collection: 'articles', draft: true, data: { title: 'x', slug: unique('x-'), _status: 'draft' } as Any, ...asPassword }))
    await assert.rejects(payload.find({ collection: 'contact-messages', ...asPassword }))
    await assert.rejects(payload.findGlobal({ slug: 'community-settings', ...asPassword }))
    await payload.delete({ collection: 'articles', id: draft.id })
  })

  it('can open the CMS and read their own staff record (needed for the set-up page), nothing more', async () => {
    assert.equal(await STAFF.access.admin({ req: req(password(staff.editor)) }), true)
    assert.equal(await STAFF.access.admin({ req: req({ ...password(staff.editor), active: false }) }), false)
    const found = await payload.find({ collection: 'staff', overrideAccess: false, user: password(staff.admin) })
    assert.deepEqual(found.docs.map((d: Any) => d.id), [staff.admin.id])
    await assert.rejects(payload.update({ collection: 'staff', id: staff.admin.id, data: { name: 'Changed' } as Any, overrideAccess: false, user: password(staff.admin) }))
  })
})

describe('visitors are not affected', () => {
  it('anonymous visitors still read published articles', async () => {
    const pub = await payload.create({ collection: 'articles', data: { title: unique('Published '), slug: unique('pub-'), _status: 'published' } as Any }).catch(() => null)
    const res = await payload.find({ collection: 'articles', overrideAccess: false, limit: 1 })
    assert.ok(Array.isArray(res.docs), 'reading as a visitor works')
    if (pub) await payload.delete({ collection: 'articles', id: pub.id })
  })
})
