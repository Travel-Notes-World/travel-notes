import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { Articles } from './collections/Articles'
import { Authors } from './collections/Authors'
import { Destinations } from './collections/Destinations'
import { Staff } from './collections/Staff'
import { Topics } from './collections/Topics'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Keep full certificate checking explicit. Neon's connection string says sslmode=require, which the
// database driver currently treats as verify-full but warns it will weaken in its next major version.
const connectionString = (process.env.DATABASE_URL || '').replace(/sslmode=(require|prefer|verify-ca)\b/, 'sslmode=verify-full')

export default buildConfig({
  admin: {
    user: Staff.slug,
    meta: { titleSuffix: '| Travel Notes CMS' },
    importMap: { baseDir: path.resolve(dirname) },
  },
  collections: [Articles, Destinations, Topics, Authors, Staff],
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
  sharp,
})
