# Browser checks (local only)

These drive a real browser against a running local server and a LOCAL database with demo data.
They create accounts and posts, so never point them at preview or production.

```
npx payload migrate && npm run destinations:import -- --min=1000000
ALLOW_DEMO_SEED=yes npm run community:demo-seed
EMAIL_TRANSPORT=capture ALLOW_EMAIL_CAPTURE=yes npm run build && npx next start -p 3100
E2E_DATABASE_URL=postgresql://…/tn_dev node tests/e2e/community-flow.cjs
E2E_DATABASE_URL=postgresql://…/tn_dev node tests/e2e/photo-upload.cjs
node tests/e2e/admin-panel.cjs
```

The community needs to be open (Community settings: public access and sign-ups ticked; the demo
seed does this). `PLAYWRIGHT_PATH` can point at a global Playwright install. Screenshots go to
`$E2E_OUT/shots` (default: this folder; git-ignored).
