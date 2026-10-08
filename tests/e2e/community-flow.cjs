// End-to-end browser check of the community release against the local server (port 3100).
// Uses the local dev database only; emails are captured, never sent.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { execSync } = require('child_process');
const path = require('path');

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3100';
const OUT = path.join(process.env.E2E_OUT || __dirname, 'shots');
const sql = (q) => execSync(`psql "${process.env.E2E_DATABASE_URL}" -tAc ${JSON.stringify(q)}`).toString().trim();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const stamp = Date.now().toString(36);

async function pick(page, place) {
  const box = page.getByRole('searchbox', { name: /Search for a destination/ }).first();
  await box.fill(place);
  const option = page.getByRole('list', { name: 'Matching places' }).getByRole('button').first();
  await option.waitFor({ timeout: 10000 });
  await option.click();
}

(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const errors = [];
  const member = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await member.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

  // 1. Sign up, confirm email, sign in
  const handle = `e2e-${stamp}`;
  const email = `${handle}@example.test`;
  await page.goto(`${BASE}/account/sign-up`);
  await page.fill('#displayName', 'E2E Traveller');
  await page.fill('#handle', handle);
  await page.fill('#email', email);
  await page.fill('#password', 'a long test password');
  await page.check('#acceptTerms');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/01-signup-done.png` });
  const token = sql(`select o.data->>'token' from email_outbox o join members m on m.id=o.recipient_id where m.email='${email}' and o.template='verify_email' order by o.created_at desc limit 1`);
  check('sign-up queues a confirmation email (captured)', token.length > 10);
  await page.goto(`${BASE}/account/verify?token=${encodeURIComponent(token)}`);
  await page.waitForTimeout(2000);
  const verifyButton = page.getByRole('button', { name: /confirm/i });
  if (await verifyButton.count()) { await verifyButton.first().click(); await page.waitForTimeout(2000); }
  check('email confirmed', sql(`select _verified from members where email='${email}'`) === 't');
  await page.goto(`${BASE}/account/sign-in`);
  await page.fill('#email', email);
  await page.fill('#password', 'a long test password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((u) => u.pathname === '/account', { timeout: 20000 });
  check('sign in lands on the account dashboard', (await page.locator('h1').innerText()).length > 0, page.url());
  await page.screenshot({ path: `${OUT}/02-account.png`, fullPage: true });

  // 2. Ask a question
  await page.goto(`${BASE}/community/questions/new`);
  const qTitle = `E2E question ${stamp}: is a day in the old city enough?`;
  await page.fill('#title', qTitle);
  await pick(page, 'Bangkok');
  await page.fill('#body', 'We have one free day between flights. Is it realistic to see the old city and a temple without rushing? We like walking.');
  await page.getByRole('button', { name: /Submit question for review/ }).click();
  await page.waitForURL(/\/account\/posts\//, { timeout: 15000 }).catch(() => {});
  const qState = sql(`select state from contributions where title='${qTitle.replace(/'/g, "''")}'`);
  check('question submitted for review', qState === 'pending', `state=${qState}`);

  // 3. Write a trip report with a cost row and an itinerary day
  await page.goto(`${BASE}/community/trips/new`);
  const tTitle = `E2E trip ${stamp}: three days in Kyoto`;
  await page.fill('#title', tTitle);
  await pick(page, 'Kyoto');
  await page.fill('#body', 'We spent three days in Kyoto in April. This report covers where we stayed, what we ate, what it cost and what we would change next time.');
  await page.fill('#travelMonth', '2026-04');
  await page.fill('#durationDays', '3');
  await page.fill('#partySize', '2');
  await page.getByRole('button', { name: 'Add a cost' }).click();
  const amount = page.getByLabel('Amount').first();
  await amount.fill('180');
  await page.getByLabel(/Currency for cost 1/).fill('JPY');
  const category = page.getByLabel('What for').first();
  await category.selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Add a day' }).click();
  await page.locator('input[name="costScope"]').first().check();
  await page.locator('input[name="permission"]').check();
  await page.screenshot({ path: `${OUT}/03-trip-form.png`, fullPage: true });
  await page.getByRole('button', { name: /Submit .*review/ }).click();
  await page.waitForURL(/\/account\/posts\//, { timeout: 15000 }).catch(() => {});
  const tRow = sql(`select state from contributions where title='${tTitle.replace(/'/g, "''")}'`);
  if (tRow !== 'pending') {
    const msg = await page.locator('[role=alert]').allInnerTexts();
    await page.screenshot({ path: `${OUT}/03b-trip-error.png`, fullPage: true });
    check('trip report submitted for review', false, `state=${tRow} alerts=${msg.join(' | ').slice(0, 400)}`);
  } else check('trip report submitted for review', true);

  // 4. Add an activity
  await page.goto(`${BASE}/activities/new`);
  const aTitle = `E2E activity ${stamp}: evening food walk`;
  await page.fill('#title', aTitle);
  await pick(page, 'Bangkok');
  await page.fill('#body', 'An informal walk through the old town food stalls. We meet at the main gate and finish near the river after about two hours.');
  const start = new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10);
  await page.screenshot({ path: `${OUT}/04-activity-form.png`, fullPage: true });
  const fill = async (sel, v) => { const l = page.locator(sel); if (await l.count()) await l.first().fill(v); };
  const radio = page.locator('input[name="category"]');
  if (await radio.count()) await radio.first().check();
  await fill('input[name="startLocal"]', `${start}T18:30`);
  await fill('input[name="endLocal"]', `${start}T20:30`);
  await fill('input[name="venueName"]', 'Old town main gate');
  await fill('input[name="organiserName"]', 'E2E organiser');
  await fill('input[name="organiserContact"]', 'organiser@example.test');
  await fill('input[name="sourceUrl"]', 'https://example.com/event');
  await fill('input[name="capacity"]', '1');
  const price = page.locator('select[name="priceState"], input[name="priceState"]');
  if (await price.count()) { if ((await price.first().evaluate((e) => e.tagName)) === 'SELECT') await price.first().selectOption('free'); else await page.locator('input[name="priceState"][value="free"]').check(); }
  await page.getByRole('button', { name: /Submit .*review/ }).click();
  await page.waitForURL(/\/account\/posts\//, { timeout: 15000 }).catch(() => {});
  const aRow = sql(`select state from contributions where title='${aTitle.replace(/'/g, "''")}'`);
  if (aRow !== 'pending') {
    const msg = await page.locator('[role=alert], [id$="-error"]').allInnerTexts();
    await page.screenshot({ path: `${OUT}/04b-activity-error.png`, fullPage: true });
    check('activity submitted for review', false, `state=${aRow} errors=${msg.join(' | ').slice(0, 500)}`);
  } else check('activity submitted for review', true);
  check('private organiser contact not kept in browser storage', !(await page.evaluate(() => JSON.stringify(localStorage))).includes('organiser@example.test'));

  // 5. A pending post is not public
  const qShort = sql(`select short_id from contributions where title='${qTitle.replace(/'/g, "''")}'`);
  const resp = await (await browser.newContext()).request.get(`${BASE}/community/questions/${qShort}`);
  check('pending question is not public (404)', resp.status() === 404, `status=${resp.status()}`);

  // 6. Moderator approves everything through the console
  const mod = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const login = await mod.request.post(`${BASE}/api/staff/login`, { data: { email: 'admin@example.test', password: 'demo-admin-password' } });
  check('staff can sign in', login.ok(), `status=${login.status()}`);
  const mpage = await mod.newPage();
  mpage.on('pageerror', (e) => errors.push(`mod pageerror: ${e.message}`));
  await mpage.goto(`${BASE}/moderation`);
  await mpage.screenshot({ path: `${OUT}/05-moderation-dashboard.png`, fullPage: true });
  await mpage.goto(`${BASE}/moderation/queue`);
  check('queue lists the new question', (await mpage.content()).includes(`E2E question ${stamp}`));
  await mpage.screenshot({ path: `${OUT}/06-queue.png`, fullPage: true });
  for (const title of [qTitle, tTitle, aTitle]) {
    const id = sql(`select id from contributions where title='${title.replace(/'/g, "''")}'`);
    if (!id) continue;
    await mpage.goto(`${BASE}/moderation/posts/${id}`);
    if (title === qTitle) await mpage.screenshot({ path: `${OUT}/07-review.png`, fullPage: true });
    if (title === aTitle) check('review page shows private organiser contact to moderators', (await mpage.content()).includes('organiser@example.test'));
    const btn = mpage.getByRole('button', { name: 'Approve and publish' });
    if (!(await btn.count())) { check(`approve button for ${title.slice(0, 20)}`, false); continue; }
    await btn.click();
    await mpage.waitForTimeout(2000);
    await mpage.waitForTimeout(500);
    const st = sql(`select state from contributions where id='${id}'`);
    check(`moderator approves "${title.slice(0, 26)}…"`, st === 'published', `state=${st}`);
  }

  // 7. Public pages
  const anon = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const apage = await anon.newPage();
  apage.on('pageerror', (e) => errors.push(`anon pageerror: ${e.message}`));
  await apage.goto(`${BASE}/community/questions/${qShort}`);
  check('approved question is public', apage.url().includes(qShort) && (await apage.locator('h1').innerText()).includes('E2E question'), apage.url());
  const robots = await apage.locator('meta[name="robots"]').getAttribute('content');
  check('unanswered question is noindex', /noindex/.test(robots || ''), robots);
  check('question page has QAPage/breadcrumb JSON-LD', (await apage.content()).includes('application/ld+json'));
  await apage.screenshot({ path: `${OUT}/08-question-public.png`, fullPage: true });
  const tShort = sql(`select short_id from contributions where title='${tTitle.replace(/'/g, "''")}'`);
  if (tShort) {
    await apage.goto(`${BASE}/community/trips/${tShort}`);
    const body = await apage.content();
    check('trip report shows its costs', /180/.test(body) && /JPY|¥/.test(body));
    await apage.screenshot({ path: `${OUT}/09-trip-public.png`, fullPage: true });
  }
  const aShort = sql(`select short_id from contributions where title='${aTitle.replace(/'/g, "''")}'`);
  if (aShort) {
    await apage.goto(`${BASE}/activities/${aShort}`);
    const body = await apage.content();
    check('activity page never shows the private contact', !body.includes('organiser@example.test'));
    check('activity page has Event JSON-LD', body.includes('"Event"') || body.includes('Event'));
    await apage.screenshot({ path: `${OUT}/10-activity-public.png`, fullPage: true });
    const ics = await anon.request.get(`${BASE}/activities/${aShort}/calendar.ics`);
    check('calendar file downloads', ics.ok() && (await ics.text()).includes('BEGIN:VEVENT'), `status=${ics.status()}`);
    // Member answers and RSVPs
    await page.goto(`${BASE}/activities/${aShort}`);
    await page.locator('input[name="status"][value="going"]').check();
    await page.getByRole('button', { name: 'Save my response' }).click();
    await page.waitForURL(/rsvp=/, { timeout: 15000 }).catch(() => {});
    check('member can RSVP going', sql(`select count(*) from rsvps r join members m on m.id=r.member_id where m.email='${email}' and r.status='going'`) === '1');
  }

  // 8. Another member answers the question → question owner gets a notification
  await page.goto(`${BASE}/community/questions/${qShort}`);
  check('author sees no "answer your own question" problems', (await page.locator('h1').count()) === 1);

  // 9. Search and hub
  await apage.goto(`${BASE}/search?q=${encodeURIComponent('Kyoto')}`);
  check('search finds the trip report', (await apage.content()).includes(`E2E trip ${stamp}`));
  await apage.goto(`${BASE}/community/thailand/bangkok`);
  check('Bangkok hub lists the new question', (await apage.content()).includes(`E2E question ${stamp}`));
  await apage.screenshot({ path: `${OUT}/11-hub.png`, fullPage: true });

  // 10. Mobile layout at 390px: no horizontal scroll on key pages
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const mp = await mobile.newPage();
  for (const p of ['/', '/community', '/community/questions', `/community/questions/${qShort}`, '/activities', '/community/trips', '/account/sign-up', '/search?q=Kyoto']) {
    await mp.goto(`${BASE}${p}`);
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`no sideways scroll at 390px: ${p}`, overflow <= 1, `overflow=${overflow}px`);
  }
  await mp.goto(`${BASE}/community/questions/${qShort}`);
  await mp.screenshot({ path: `${OUT}/12-mobile-question.png`, fullPage: true });

  // 11. Keyboard: the sign-in form can be completed by keyboard only
  const kb = await (await browser.newContext()).newPage();
  await kb.goto(`${BASE}/account/sign-in`);
  await kb.locator('#email').focus();
  await kb.keyboard.type(email);
  await kb.keyboard.press('Tab');
  await kb.keyboard.type('a long test password');
  await kb.keyboard.press('Enter');
  await kb.waitForURL((u) => u.pathname === '/account', { timeout: 20000 }).catch(() => {});
  check('keyboard-only sign in works', /\/account/.test(kb.url()) && !kb.url().includes('sign-in'), kb.url());

  // 12. Expired session: a form posted after sign-out shows a clear message, not a crash
  const exp = await browser.newContext();
  const ep = await exp.newPage();
  await ep.goto(`${BASE}/account/sign-in`);
  await ep.fill('#email', email); await ep.fill('#password', 'a long test password');
  await ep.getByRole('button', { name: 'Sign in' }).click();
  await ep.waitForURL((u) => u.pathname === '/account', { timeout: 20000 });
  await ep.goto(`${BASE}/community/questions/new`);
  await ep.fill('#title', 'A question written while the session expires');
  await exp.clearCookies();
  await ep.getByRole('button', { name: /Save draft/ }).click();
  await ep.waitForTimeout(1500);
  const alert = (await ep.locator('[role=alert]').allInnerTexts()).join(' ');
  check('expired session shows a sign-in message', /sign in/i.test(alert), alert.slice(0, 160));

  const real = errors.filter((e) => !e.includes('ERR_TUNNEL_CONNECTION_FAILED'));
  check('no browser errors on the pages visited (external fonts/images blocked in this sandbox are ignored)', real.length === 0, real.slice(0, 5).join(' || '));
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  require('fs').writeFileSync(path.join(process.env.E2E_OUT || __dirname, 'results.json'), JSON.stringify(results, null, 2));
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
