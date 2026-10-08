const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3100';
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1400,height:900}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(`${BASE}/admin/login`); await p.fill('#field-email','admin@example.test'); await p.fill('#field-password','demo-admin-password');
  await p.getByRole('button',{name:/login/i}).click(); await p.waitForURL(u=>u.pathname==='/admin',{timeout:30000});
  console.log('dashboard link to moderation:', await p.getByRole('link',{name:/moderation/i}).count());
  await p.screenshot({path:(process.env.E2E_OUT || __dirname)+'/shots/14-admin.png'});
  for (const c of ['contributions','members','replies','media','destinations','articles','staff','plans']) {
    const r=await p.goto(`${BASE}/admin/collections/${c}`); await p.waitForTimeout(1500);
    const txt=await p.locator('body').innerText();
    console.log(c, r.status(), /error|not allowed|unauthori/i.test(txt.slice(0,2000))?'MESSAGE: '+txt.slice(0,160).replace(/\n/g,' '):'ok');
  }
  const g=await p.goto(`${BASE}/admin/globals/community-settings`); await p.waitForTimeout(1500); console.log('settings', g.status());
  console.log('page errors:', errs.slice(0,3));
  await b.close();
})().catch(e=>{console.error(e);process.exit(2)});
