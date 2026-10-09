// Build command used by Vercel (package.json "vercel-build").
//
// On the PRODUCTION deployment only, database migrations run before the site is built, so new
// code never goes live without the tables it needs. Migrations run inside a transaction: if one
// fails, the build fails and Vercel keeps serving the previous deployment.
//
// Preview deployments never migrate, because a preview may share a database with production.
// Local builds use "npm run build" and are not affected.
import { execSync } from 'node:child_process'

const run = (command) => execSync(command, { stdio: 'inherit', env: process.env })

if (process.env.VERCEL_ENV === 'production') {
  console.log('[vercel-build] Production deployment: applying database migrations')
  run('npx payload migrate')
} else {
  console.log(`[vercel-build] ${process.env.VERCEL_ENV || 'local'} build: skipping database migrations`)
}

run('npx next build')
