// End-to-end browser check of community accounts and the moderator's member tools, against the
// local server (port 3100) and a LOCAL database. Emails are captured, never sent.
//
//   E2E_DATABASE_URL=postgresql://…/tn_dev node tests/e2e/account-flow.cjs
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { execSync } = require('child_process');

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3100';
const sql = (q) => execSync(`psql "${process.env.E2E_DATABASE_URL}" -tAc ${JSON.stringify(q)}`).toString().trim();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const stamp = Date.now().toString(36);
const latestToken = (email, template) => sql(`select o.data->>'token' from email_outbox o join members m on m.id=o.recipient_id where m.email='${email}' and o.template='${template}' order by o.created_at desc limit 1`);
const alerts = async (page) => (await page.locator('[role=alert], [role=status]').allInnerTexts()).join(' | ');

async function signIn(page, email, password) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/account/sign-in`);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  try { await page.waitForURL((u) => u.pathname === '/account', { timeout: 15000 }); return true } catch { return false }
}
const signedIn = async (context) => (await (await context.request.get(`${BASE}/account/session`)).json()).signedIn === true;

async function signUp(page, handle, email, password) {
  await page.goto(`${BASE}/account/sign-up`);
  await page.fill('#displayName', 'Account Tester');
  await page.fill('#handle', handle);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.check('#acceptTerms');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForTimeout(1500);
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const watch = (page, label) => {
    page.on('pageerror', (e) => errors.push(`${label} pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${label} console: ${m.text()}`); });
  };
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  watch(page, 'member');

  // 1. Sign-up validation
  const handle = `acct-${stamp}`;
  const email = `${handle}@example.test`;
  let password = 'first long password';
  await signUp(page, 'X', email, 'short');
  const signupErrors = await page.locator('body').innerText();
  check('sign-up rejects a bad handle and short password with clear messages', /3 to 30 lowercase/.test(signupErrors) && /at least 10 characters/.test(signupErrors));
  await signUp(page, 'demo-asha', `other-${stamp}@example.test`, password);
  check('sign-up refuses a handle that is taken', /already taken/.test(await page.locator('body').innerText()));

  // 2. Sign-up, then signing in before confirming
  await signUp(page, handle, email, password);
  check('sign-up shows the "check your email" page', /sent=1/.test(page.url()), page.url());
  check('member row created, not yet confirmed', sql(`select _verified from members where email='${email}'`) === 'f');
  await page.goto(`${BASE}/account/sign-in`);
  await page.fill('#email', email); await page.fill('#password', password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForTimeout(1500);
  check('unconfirmed sign-in explains the email must be confirmed', /confirm your email/i.test(await alerts(page)), (await alerts(page)).slice(0, 200));
  const before = Number(sql(`select count(*) from email_outbox o join members m on m.id=o.recipient_id where m.email='${email}' and o.template='verify_email'`));
  const resend = page.locator('#resend-email');
  if (await resend.count()) {
    await resend.fill(email);
    await page.getByRole('button', { name: /send/i }).last().click();
    await page.waitForTimeout(1500);
  }
  const after = Number(sql(`select count(*) from email_outbox o join members m on m.id=o.recipient_id where m.email='${email}' and o.template='verify_email'`));
  check('resend confirmation form is offered and answers', (await resend.count()) > 0 && after >= before, `before=${before} after=${after}`);

  // 3. Confirm email
  await page.goto(`${BASE}/account/verify?token=${encodeURIComponent(latestToken(email, 'verify_email'))}`);
  await page.waitForTimeout(1000);
  const confirm = page.getByRole('button', { name: /confirm/i });
  if (await confirm.count()) { await confirm.first().click(); await page.waitForTimeout(1500); }
  check('confirmation link confirms the email', sql(`select _verified from members where email='${email}'`) === 't');
  await page.goto(`${BASE}/account/verify?token=${'a'.repeat(40)}`);
  const badConfirm = page.getByRole('button', { name: /confirm/i });
  if (await badConfirm.count()) { await badConfirm.first().click(); await page.waitForTimeout(1000); }
  check('a wrong confirmation link shows a clear message', /did not work/i.test(await page.locator('body').innerText()));

  // 4. Sign in
  check('wrong password is refused', !(await signIn(page, email, 'not the password at all')) && /not correct/.test(await alerts(page)));
  check('sign in lands on /account', await signIn(page, email, password));
  check('header session endpoint reports signed in', await signedIn(ctx));

  // 5. Profile and email settings
  await page.goto(`${BASE}/account/settings`);
  await page.fill('#displayName', 'Renamed Tester');
  await page.fill('#bio', 'I like slow trains.');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await page.waitForTimeout(1500);
  check('profile saves', sql(`select display_name||'|'||bio from members where email='${email}'`) === 'Renamed Tester|I like slow trains.');
  await page.fill('#experience', 'see https://spam.example');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await page.waitForTimeout(1200);
  check('profile refuses links in experience', /without links/.test(await page.locator('body').innerText()));
  await page.reload();
  const digest = page.locator('input[name="digest"]');
  await digest.check();
  await page.getByRole('button', { name: 'Save email settings' }).click();
  await page.waitForTimeout(1500);
  check('email settings save', sql(`select email_prefs_digest from members where email='${email}'`) === 't');

  // 6. Change password: wrong current, then right; this browser stays signed in, others are signed out
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signIn(otherPage, email, password);
  check('second browser signed in', await signedIn(other));
  await page.goto(`${BASE}/account/settings`);
  await page.fill('#current', 'not my password');
  await page.fill('#next', 'second long password');
  await page.getByRole('button', { name: 'Change password' }).click();
  await page.waitForTimeout(1500);
  check('change password refuses a wrong current password', /not correct/.test(await page.locator('body').innerText()));
  await page.fill('#current', password);
  await page.fill('#next', 'second long password');
  await page.getByRole('button', { name: 'Change password' }).click();
  await page.waitForTimeout(1500);
  check('change password confirms', /password is changed/i.test(await page.locator('body').innerText()));
  password = 'second long password';
  check('this browser is still signed in after changing the password', await signedIn(ctx));
  await page.goto(`${BASE}/account/settings`);
  check('settings page still opens after changing the password', new URL(page.url()).pathname === '/account/settings', page.url());
  check('other browsers are signed out after a password change', !(await signedIn(other)));
  const fresh = await (await browser.newContext()).newPage();
  check('old password no longer works', !(await signIn(fresh, email, 'first long password')));
  check('new password works', await signIn(fresh, email, password));

  // 7. Export
  const exp = await ctx.request.get(`${BASE}/account/export`);
  check('data export downloads JSON with the account', exp.ok() && (await exp.text()).includes(email), `status=${exp.status()}`);

  // 8. Sign out
  await page.goto(`${BASE}/account`);
  await page.getByRole('button', { name: /sign out/i }).first().click();
  await page.waitForTimeout(1500);
  check('sign out ends the session', !(await signedIn(ctx)));
  await page.goto(`${BASE}/account`);
  check('signed-out /account redirects to sign-in', page.url().includes('/account/sign-in'), page.url());

  // 9. Forgot and reset password
  await page.goto(`${BASE}/account/forgot-password`);
  await page.fill('#email', email);
  await page.getByRole('button', { name: /send/i }).click();
  await page.waitForTimeout(1500);
  const reset = latestToken(email, 'password_reset');
  check('forgot password queues a reset email', reset.length > 10);
  await page.goto(`${BASE}/account/reset-password?token=${encodeURIComponent(reset)}`);
  await page.fill('#password', 'third long password');
  await page.getByRole('button', { name: 'Save the new password' }).click();
  await page.waitForTimeout(2000);
  check('reset lands on sign-in with a notice', page.url().includes('/account/sign-in'), page.url());
  check('signed-in browsers are signed out by a reset', !(await signedIn(await fresh.context())));
  password = 'third long password';
  check('reset password works for sign in', await signIn(page, email, password));
  await page.goto(`${BASE}/account/reset-password?token=${encodeURIComponent(reset)}`);
  await page.fill('#password', 'fourth long password');
  await page.getByRole('button', { name: 'Save the new password' }).click();
  await page.waitForTimeout(1500);
  check('a used reset link is refused', /not valid|expired/i.test(await page.locator('body').innerText()));

  // 10. Moderator: find, review, suspend, lift
  const modCtx = await browser.newContext();
  const login = await modCtx.request.post(`${BASE}/api/staff/login`, { data: { email: 'admin@example.test', password: 'demo-admin-password' } });
  check('moderator signs in', login.ok(), `status=${login.status()}`);
  const mod = await modCtx.newPage();
  watch(mod, 'moderator');
  await mod.goto(`${BASE}/moderation/members?q=${encodeURIComponent(email)}`);
  const link = mod.getByRole('list', { name: 'Members' }).getByRole('link').first();
  check('moderator finds the member by email', (await link.count()) > 0);
  await link.click();
  await mod.waitForURL(/\/moderation\/members\/[0-9a-f-]+$/);
  const memberUrl = mod.url();
  const overview = await mod.locator('main').innerText();
  check('member page shows email, status and confirmation', overview.includes(email) && /Active/.test(overview) && /Email confirmed\s*Yes/.test(overview));
  await mod.locator('textarea[name="reason"]').first().fill('Repeated off-topic posts.');
  await mod.getByRole('button', { name: 'Suspend account' }).click();
  await mod.waitForTimeout(1500);
  check('moderator suspends the account', sql(`select status from members where email='${email}'`) === 'suspended');
  await page.goto(`${BASE}/community/questions/new`);
  await page.fill('#title', 'A question from a suspended member account');
  await page.getByRole('button', { name: /Save draft/ }).click();
  await page.waitForTimeout(1500);
  check('suspended member cannot post and sees why', /suspended/i.test(await alerts(page)), (await alerts(page)).slice(0, 200));
  check('suspended member got a notification', Number(sql(`select count(*) from notifications n join members m on m.id=n.recipient_id where m.email='${email}' and n.type='account_notice'`)) >= 1);
  await mod.goto(memberUrl);
  await mod.getByRole('button', { name: 'Lift the suspension' }).click();
  await mod.waitForTimeout(1500);
  check('moderator lifts the suspension', sql(`select status from members where email='${email}'`) === 'active');
  await mod.goto(memberUrl);
  await mod.getByRole('button', { name: 'Mark as trusted' }).click();
  await mod.waitForTimeout(1200);
  check('moderator marks the member trusted', sql(`select trusted from members where email='${email}'`) === 't');
  const audit = Number(sql(`select count(*) from moderation_actions a join members m on m.id::text=a.target_id where m.email='${email}' and a.action in ('suspend','unsuspend','set_trust')`));
  check('account decisions are in the audit log', audit >= 3, `count=${audit}`);

  // 11. Moderator help for members who are stuck: password reset link, confirmation email
  await mod.goto(memberUrl);
  const sendReset = mod.getByRole('button', { name: /password reset link/i });
  check('moderator can send a password reset link', (await sendReset.count()) > 0);
  if (await sendReset.count()) {
    const n = Number(sql(`select count(*) from email_outbox o join members m on m.id=o.recipient_id where m.email='${email}' and o.template='password_reset'`));
    await sendReset.click();
    await mod.waitForTimeout(1500);
    const m2 = Number(sql(`select count(*) from email_outbox o join members m on m.id=o.recipient_id where m.email='${email}' and o.template='password_reset'`));
    check('the reset link email is queued for the member', m2 === n + 1, `before=${n} after=${m2}`);
    check('moderator never sees the reset link', !(await mod.locator('main').innerText()).includes(latestToken(email, 'password_reset')));
  }
  const stuckHandle = `stuck-${stamp}`;
  const stuckEmail = `${stuckHandle}@example.test`;
  const sp = await (await browser.newContext()).newPage();
  await signUp(sp, stuckHandle, stuckEmail, 'a stuck long password');
  await mod.goto(`${BASE}/moderation/members?q=${stuckHandle}`);
  await mod.getByRole('list', { name: 'Members' }).getByRole('link').first().click();
  await mod.waitForURL(/\/moderation\/members\/[0-9a-f-]+$/);
  check('unconfirmed member shows "Email confirmed: No"', /Email confirmed\s*No/.test(await mod.locator('main').innerText()));
  const resendBtn = mod.getByRole('button', { name: /confirmation email/i });
  check('moderator can send the confirmation email again', (await resendBtn.count()) > 0);
  if (await resendBtn.count()) {
    await resendBtn.click();
    await mod.waitForTimeout(1500);
    check('confirmation resend is answered', /sent|queued/i.test(await alerts(mod)), (await alerts(mod)).slice(0, 160));
  }
  const markBtn = mod.getByRole('button', { name: /mark .*confirmed/i });
  check('moderator can mark the email as confirmed', (await markBtn.count()) > 0);
  if (await markBtn.count()) {
    await mod.locator('form', { has: markBtn }).locator('textarea').fill('Member proved the address by replying from it.');
    await markBtn.click();
    await mod.waitForTimeout(1500);
    check('email is confirmed after the moderator marks it', sql(`select _verified from members where email='${stuckEmail}'`) === 't');
    check('member can sign in after a moderator confirms', await signIn(sp, stuckEmail, 'a stuck long password'));
  }

  // 12. Delete account
  await signIn(page, email, password);
  await page.goto(`${BASE}/account/settings`);
  await page.getByText('I want to delete my account').click();
  await page.fill('#delete-password', 'wrong password here');
  await page.fill('#confirm', 'DELETE');
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await page.waitForTimeout(1500);
  check('delete refuses a wrong password', /not correct/.test(await page.locator('body').innerText()));
  await page.fill('#delete-password', password);
  await page.fill('#confirm', 'DELETE');
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await page.waitForTimeout(2500);
  check('delete lands on the goodbye page', page.url().includes('/account/deleted'), page.url());
  check('deleted account cannot sign in', !(await signIn(fresh, email, password)));
  check('deleted account email is removed', sql(`select count(*) from members where email='${email}'`) === '0');

  const real = errors.filter((e) => !/ERR_TUNNEL_CONNECTION_FAILED|Failed to load resource/.test(e));
  check('no browser errors', real.length === 0, real.slice(0, 5).join(' || '));
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
