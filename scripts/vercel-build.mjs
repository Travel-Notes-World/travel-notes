// Build command used by Vercel (package.json "vercel-build").
//
// Database migrations run before the site is built, so new code never goes live without the
// tables it needs. Migrations run inside a transaction: if one fails, the build fails and Vercel
// keeps serving the previous deployment.
//
// - Production: always migrates (the production Neon branch).
// - Preview: migrates only when PREVIEW_DATABASE_IS_SEPARATE=yes is set for the Preview
//   environment, which confirms Preview's DATABASE_URL points at its own Neon branch ("preview"),
//   never production. Without it, preview builds skip migrations, as before.
// - Local builds use "npm run build" and are not affected.
import { execSync } from 'node:child_process'

const run = (command) => execSync(command, { stdio: 'inherit', env: process.env })
const target = process.env.VERCEL_ENV || 'local'

if (target === 'production') {
  console.log('[vercel-build] Production deployment: applying database migrations')
  run('npx payload migrate')
} else if (target === 'preview' && process.env.PREVIEW_DATABASE_IS_SEPARATE === 'yes') {
  console.log('[vercel-build] Preview deployment on its own database: applying database migrations')
  run('npx payload migrate')
} else {
  console.log(`[vercel-build] ${target} build: skipping database migrations`)
}

run('npx next build')
