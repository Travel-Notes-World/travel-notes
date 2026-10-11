// Signs a staff member in the way a person does: password at /admin/login, then the 6-digit code
// from an authenticator app (two-step login is required for every staff account). On the first
// run the account is set up with a new code secret, which is kept in $E2E_OUT/.totp-<email> so
// later runs can produce codes. Local test databases only.
const fs = require('fs');
const path = require('path');
const { TOTP, Secret } = require('otpauth');

async function staffSignIn(context, { base, email, password, out }) {
  const page = await context.newPage();
  const file = path.join(out, `.totp-${email.replace(/[^a-z0-9]/gi, '_')}`);
  let secret = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '';
  const code = () => new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30, algorithm: 'SHA1' }).generate();
  const typeCode = async (c) => {
    const boxes = page.locator('input[maxlength="1"]');
    await boxes.first().waitFor();
    for (let i = 0; i < 6; i++) { await boxes.nth(i).focus(); await page.keyboard.press(c[i]); await page.waitForTimeout(60); }
  };
  await page.goto(`${base}/admin/login`);
  await page.fill('#field-email', email);
  await page.fill('#field-password', password);
  await page.click('button[type=submit]');
  // Wait until the password step has finished and the CMS has moved on from the login page.
  await page.waitForURL((u) => u.pathname !== '/admin/login', { timeout: 60000 });
  if (/setup-totp/.test(page.url())) {
    await page.getByText('Add code manually').click();
    await page.waitForTimeout(500);
    secret = (await page.locator('code').first().innerText()).replace(/\s+/g, '');
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(file, secret, { mode: 0o600 });
    await typeCode(code());
  } else if (/verify-totp/.test(page.url())) {
    if (!secret) throw new Error(`No saved code secret for ${email}. Reset its two-step login (npm run staff:reset-2fa) and run again.`);
    await typeCode(code());
  }
  // After the code the CMS returns to where sign-in started; leaving the code page is the signal.
  await page.waitForURL((u) => !/totp/.test(u.pathname), { timeout: 60000 });
  await page.goto(`${base}/admin`);
  if (/login|totp/.test(new URL(page.url()).pathname)) throw new Error(`Staff sign-in did not finish (ended on ${page.url()}).`);
  const cookies = (await context.cookies()).map((c) => c.name);
  if (!cookies.some((n) => n.endsWith('-totp'))) throw new Error(`Staff sign-in finished without the two-step cookie (cookies: ${cookies.join(', ') || 'none'}).`);
  return page;
}

module.exports = { staffSignIn };
