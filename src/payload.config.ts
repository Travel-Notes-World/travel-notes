import { postgresAdapter } from '@payloadcms/db-postgres'
import { s3Storage } from '@payloadcms/storage-s3'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { payloadTotp } from 'payload-totp'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { Articles } from './collections/Articles'
import { Authors } from './collections/Authors'
import { ContactMessages } from './collections/ContactMessages'
import { NewsletterSubscribers } from './collections/NewsletterSubscribers'
import { communityCollections } from './collections/community'
import { Destinations } from './collections/Destinations'
import { Staff } from './collections/Staff'
import { staffTwoFactorDisabled } from './access/twoFactor'
import { Topics } from './collections/Topics'
import { Redirects } from './collections/Redirects'
import { TravelUpdates } from './collections/TravelUpdates'
import { CommunitySettings } from './globals/CommunitySettings'
import { LIMITS } from './lib/community/constants'
import { s3Config } from './lib/community/storage'
import { payloadEmailAdapter } from './lib/community/email/payload-adapter'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Keep full certificate checking explicit. Neon's connection string says sslmode=require, which the
// database driver currently treats as verify-full but warns it will weaken in its next major version.
const connectionString = (process.env.DATABASE_URL || '').replace(/sslmode=(require|prefer|verify-ca)\b/, 'sslmode=verify-full')

const s3 = s3Config()

export default buildConfig({
  admin: {
    user: Staff.slug,
    meta: { titleSuffix: '| Travel Notes CMS' },
    importMap: { baseDir: path.resolve(dirname) },
    components: { beforeDashboard: ['/components/admin/CommunityModerationLink'] },
  },
  collections: [Articles, TravelUpdates, Destinations, Topics, Redirects, Authors, Staff, ContactMessages, NewsletterSubscribers, ...communityCollections],
  globals: [CommunitySettings],
  // Uploads over the limit are refused, not silently cut short.
  upload: { limits: { fileSize: LIMITS.uploadMaxBytes }, abortOnLimit: true },
  plugins: [
    // Member photos go to S3-compatible storage (Cloudflare R2) when it is configured. Files are still
    // served through the CMS, so the "approved photos only" rule guards every file address.
    s3Storage({
      enabled: Boolean(s3),
      collections: { media: true },
      bucket: s3?.bucket ?? 'not-configured',
      config: s3 ? { endpoint: s3.endpoint, region: s3.region, credentials: s3.credentials, forcePathStyle: true } : {},
    }),
    // Staff two-step login with an authenticator app. Must stay the LAST plugin. Every staff account
    // has to set it up at its next sign-in (forceSetup). The plugin's own access wrapper is off; the
    // rule is enforced in src/access/twoFactor.ts instead, so visitors keep reading published content.
    payloadTotp({
      collection: 'staff',
      forceSetup: true,
      disableAccessWrapper: true,
      disabled: staffTwoFactorDisabled(),
      totp: { issuer: 'Travel Notes CMS' },
    }),
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  // The site reads content on the server through the Local API, so the public GraphQL endpoint is not needed.
  graphQL: { disable: true },
  db: postgresAdapter({
    pool: { connectionString },
    idType: 'uuid',
    // Schema changes go through reviewed migration files in src/migrations, never automatic sync.
    push: false,
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  // Staff emails (password reset) use the same transport as community email.
  email: payloadEmailAdapter,
  sharp,
})
