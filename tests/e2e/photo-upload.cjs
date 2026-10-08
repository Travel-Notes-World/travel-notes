/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script run outside the app build */
// Browser check: a member adds a photo to a trip draft; the stored file has no GPS metadata.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3100';
const sql = (q) => execSync(`psql "${process.env.E2E_DATABASE_URL}" -tAc ${JSON.stringify(q)}`).toString().trim();

(async () => {
  const img = path.join(require('os').tmpdir(), 'photo-with-gps.jpg');
  await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 30, g: 120, b: 160 } } })
    .jpeg().withExif({ IFD0: { Make: 'TestCam' }, GPS: { GPSLatitudeRef: 'N', GPSLatitude: '35/1 0/1 0/1' } }).toFile(img);
  const before = await sharp(img).metadata();
  console.log('source has EXIF:', Boolean(before.exif));

  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${BASE}/account/sign-in`);
  await page.fill('#email', 'demo-asha@example.test');
  await page.fill('#password', 'demo-password-123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((u) => u.pathname === '/account', { timeout: 20000 });
  await page.goto(`${BASE}/community/trips/new`);
  await page.fill('#title', `Photo test trip ${Date.now().toString(36)}`);
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.waitForURL(/\/account\/posts\//, { timeout: 20000 });
  console.log('draft saved at', new URL(page.url()).pathname);
  await page.locator('input[type="file"]').setInputFiles(img);
  await page.getByLabel(/Describe the photo/).fill('A plain blue test image used to check uploads.');
  await page.getByLabel(/I took this photo/).check();
  await page.getByRole('button', { name: /Upload|Add photo/i }).click();
  await page.waitForTimeout(8000);
  await page.screenshot({ path: path.join(process.env.E2E_OUT || __dirname, 'shots', '13-photo-upload.png'), fullPage: true });
  console.log('alerts:', (await page.locator('[role=alert],[role=status]').allInnerTexts()).join(' | ').slice(0, 600));
  const row = sql("select filename || '|' || state || '|' || coalesce(width::text,'') from media order by created_at desc limit 1");
  console.log('stored:', row);
  const file = path.join(require('path').resolve('media'), row.split('|')[0]);
  const after = await sharp(fs.readFileSync(file)).metadata();
  console.log('stored format:', after.format, 'size:', after.width + 'x' + after.height, 'EXIF present:', Boolean(after.exif));
  await page.screenshot({ path: path.join(process.env.E2E_OUT || __dirname, 'shots', '13-photo-upload.png'), fullPage: true });
  await browser.close();
  const ok = after.format === 'webp' && !after.exif && row.includes('|pending|');
  console.log(ok ? 'PASS photo upload, re-encoded to WebP, metadata removed, waiting for review' : 'FAIL photo upload');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
