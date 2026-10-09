/**
 * Clear a staff member's two-step login, for example after they lost their phone.
 * At their next sign-in the CMS asks them to set up an authenticator app again.
 *
 *   DATABASE_URL=... PAYLOAD_SECRET=... npm run staff:reset-2fa -- person@example.com
 *
 * Run it only after confirming the request really comes from that person (call them).
 */
async function resetStaffTwoFactor() {
  const email = (process.argv[2] || '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    console.error('Give the staff email address: npm run staff:reset-2fa -- person@example.com')
    process.exit(1)
  }
  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config })
  const found = await payload.find({ collection: 'staff', where: { email: { equals: email } }, limit: 1, depth: 0 })
  const person = found.docs[0]
  if (!person) {
    console.error(`No staff account with the email ${email}.`)
    process.exit(1)
  }
  // Trusted server code: the Local API's default overrideAccess lets it clear the hidden secret field.
  await payload.update({ collection: 'staff', id: person.id, data: { totpSecret: null, loginAttempts: 0, lockUntil: null } as Record<string, unknown> })
  // Wrong-code counter and lock kept by the plugin for this account.
  await payload.db.deleteMany({ collection: 'totp-attempts', where: { id: { equals: String(person.id) } } }).catch(() => undefined)
  console.log(`Two-step login cleared for ${email}. They will be asked to set it up again at their next sign-in.`)
  process.exit(0)
}

resetStaffTwoFactor().catch((error) => {
  console.error(error)
  process.exit(1)
})
