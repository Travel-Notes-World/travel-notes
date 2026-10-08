/**
 * DEMO DATA FOR A DEVELOPER'S OWN COMPUTER ONLY.
 *
 *   ALLOW_DEMO_SEED=yes npm run community:demo-seed
 *
 * Creates clearly labelled synthetic members and posts ("[Demo]" titles, "Demo" names,
 * @example.test addresses) so the community pages can be tried locally. It refuses to run unless
 * the database is on this computer, so it can never put invented travellers or experiences on a
 * real site. Never run it against a preview or production database.
 */
async function main() {
  const url = process.env.DATABASE_URL ?? ''
  const host = (() => { try { return new URL(url).hostname } catch { return '' } })()
  if (process.env.ALLOW_DEMO_SEED !== 'yes' || !['localhost', '127.0.0.1', '::1'].includes(host)) {
    console.error('Refusing to run: demo data is only for a database on this computer (localhost), with ALLOW_DEMO_SEED=yes.')
    process.exit(1)
  }
  process.env.EMAIL_TRANSPORT = 'capture'
  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config })
  const { signUp, verifyEmail, toActor } = await import('../src/lib/community/members')
  const { saveContribution } = await import('../src/lib/community/contributions')
  const { decideContribution, decideReply } = await import('../src/lib/community/moderation')
  const { postReply, setAcceptedAnswer } = await import('../src/lib/community/replies')

  await payload.updateGlobal({ slug: 'community-settings', data: { publicAccess: true, signupsOpen: true, submissionsOpen: true } })
  let admin = (await payload.find({ collection: 'staff', where: { role: { equals: 'administrator' } }, limit: 1 })).docs[0]
  if (!admin) admin = await payload.create({ collection: 'staff', data: { name: 'Demo Admin', email: 'admin@example.test', password: 'demo-admin-password', role: 'administrator' } as never })
  const mod = { kind: 'staff' as const, id: admin.id, name: admin.name, canModerate: true, isAdministrator: true }
  const place = async (path: string) => (await payload.find({ collection: 'destinations', where: { path: { equals: path } }, limit: 1 })).docs[0]?.id
  const bangkok = await place('thailand/bangkok')
  const tokyo = await place('japan/tokyo')
  const thailand = await place('thailand')
  if (!bangkok || !tokyo || !thailand) throw new Error('Import destinations first: npm run destinations:import')

  const member = async (handle: string, name: string) => {
    const email = `${handle}@example.test`
    const existing = (await payload.find({ collection: 'members', where: { email: { equals: email } }, limit: 1 })).docs[0]
    if (!existing) {
      await signUp({ email, password: 'demo-password-123', handle, displayName: name, acceptTerms: true }, { ip: null })
      const doc = (await payload.find({ collection: 'members', where: { email: { equals: email } }, limit: 1, showHiddenFields: true })).docs[0] as never as { _verificationToken: string }
      await verifyEmail(doc._verificationToken)
    }
    return toActor((await payload.find({ collection: 'members', where: { email: { equals: email } }, limit: 1 })).docs[0])
  }
  const asha = await member('demo-asha', 'Demo Asha')
  const ben = await member('demo-ben', 'Demo Ben')
  const chi = await member('demo-chi', 'Demo Chi')

  const publish = async (who: Awaited<ReturnType<typeof member>>, type: 'question' | 'trip' | 'activity', input: Record<string, unknown>) => {
    const saved = await saveContribution(who, { type, input, intent: 'submit' })
    await decideContribution(mod, saved.id, { decision: 'approve' })
    return saved.id
  }
  const q1 = await publish(asha, 'question', { title: '[Demo] Is two days enough for the main temples in Bangkok?', body: 'DEMO CONTENT. This is a synthetic question created for local testing. We arrive on Friday evening and leave on Sunday night.', destinations: [bangkok], travelMonth: '2027-02', durationDays: 2, partyType: 'couple' })
  await publish(ben, 'question', { title: '[Demo] Which Tokyo neighbourhood is easiest with a pram?', body: 'DEMO CONTENT. A synthetic question for local testing about getting around with a small child.', destinations: [tokyo], partyType: 'family' })
  const r1 = await postReply(ben, { contributionId: q1, body: 'DEMO CONTENT. A synthetic answer: start at opening time and group the temples by area.' })
  await decideReply(mod, r1.id, { decision: 'approve' })
  await setAcceptedAnswer(asha, { contributionId: q1, replyId: r1.id })
  await publish(chi, 'trip', {
    title: '[Demo] Four days in Bangkok on a mid-range budget', body: 'DEMO CONTENT. A synthetic trip report for local testing. None of this is a real experience.', destinations: [bangkok],
    travelMonth: '2026-08', durationDays: 4, nights: 3, partySize: 2, partyType: 'couple', permission: true, costScope: 'per_party', style: 'mid_range',
    costs: [{ category: 'accommodation', amount: '45.00', currency: 'USD', basis: 'per_night', quantity: 3 }, { category: 'food', amount: '3200', currency: 'THB', kind: 'estimate' }],
    days: [{ title: 'Old town', stops: [{ title: '[Demo] River temples', timeNote: 'Morning' }, { title: '[Demo] Night market' }] }, { title: 'Day trip', stops: [{ title: '[Demo] Floating market' }] }],
  })
  const day = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
  await publish(asha, 'activity', { title: '[Demo] Evening food walk for travellers', body: 'DEMO CONTENT. A synthetic activity for local testing. Not a real event.', destinations: [bangkok], category: 'community_gathering', format: 'in_person', venueName: '[Demo] Old town main gate', timeZone: 'Asia/Bangkok', startLocal: `${day}T18:30`, endLocal: `${day}T20:30`, priceState: 'free', organiserName: 'Demo Asha', organiserContact: 'demo-asha@example.test' })
  await saveContribution(ben, { type: 'question', input: { title: '[Demo] A question waiting in the review queue', body: 'DEMO CONTENT. This one stays pending so the moderation queue has something in it.', destinations: [thailand] }, intent: 'submit' })
  console.log('Demo data ready. Members sign in with demo-asha@example.test (and demo-ben, demo-chi) / demo-password-123.')
  process.exit(0)
}

main().catch((error) => { console.error(error); process.exit(1) })
