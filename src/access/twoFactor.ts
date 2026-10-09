/**
 * Staff two-step login (TOTP, through the payload-totp plugin).
 *
 * The plugin's automatic "access wrapper" is turned off, because it refuses every request without a
 * logged-in user, and visitors read published content as anonymous users. Instead the rule lives
 * here, in the one place every staff permission already goes through (hasRole, userCanModerate and
 * the site's session lookup): a staff account has its rights only after entering a code in this
 * session. Until a staff member has set up an authenticator app, they can sign in and reach the
 * set-up page, and nothing else.
 *
 * Members (the community) do not use two-step login and are not affected.
 */

/**
 * Automated tests can switch the rule off with STAFF_2FA=off. That is ignored in a production
 * build, so it can never weaken the live site.
 */
export const staffTwoFactorDisabled = (): boolean => process.env.NODE_ENV !== 'production' && process.env.STAFF_2FA === 'off'

/** True when this staff session has passed the second step (or used an API key, which TOTP does not cover). */
export const staffSecondStepDone = (user: unknown): boolean => {
  if (staffTwoFactorDisabled()) return true
  const strategy = (user as { _strategy?: string } | null | undefined)?._strategy
  return strategy === 'totp' || strategy === 'api-key'
}
