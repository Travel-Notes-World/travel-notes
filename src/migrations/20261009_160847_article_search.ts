import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

import { lexicalPlainText } from '../lib/content/plainText'

/**
 * Full-text search for editorial guides.
 *
 * - "search_text": the body as plain text, kept up to date by the Articles collection on every save.
 * - "search_vector": built by the database from title (weight A), deck and excerpt (B) and the
 *   body text (C), so a match in the title ranks highest. It is a generated column, so it can never
 *   fall out of step with the row. Only the main "articles" row is indexed, which always holds the
 *   published version: a pending draft lives in "_articles_v" and is never searchable.
 * - A GIN index on "search_vector".
 *
 * Safe to run twice (IF NOT EXISTS everywhere). Existing articles get their body text filled in.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "search_text" varchar;
  ALTER TABLE "_articles_v" ADD COLUMN IF NOT EXISTS "version_search_text" varchar;
  ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "search_vector" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("deck", '') || ' ' || coalesce("excerpt", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("search_text", '')), 'C')
  ) STORED;
  CREATE INDEX IF NOT EXISTS "articles_search_vector_idx" ON "articles" USING GIN ("search_vector");`)

  // Fill in the body text for articles saved before this migration.
  const { rows } = await db.execute(sql`SELECT "id", "body" FROM "articles" WHERE "search_text" IS NULL AND "body" IS NOT NULL`)
  for (const row of rows as { id: string; body: unknown }[]) {
    await db.execute(sql`UPDATE "articles" SET "search_text" = ${lexicalPlainText(row.body)} WHERE "id" = ${row.id}`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // The index and the generated column depend on "search_text", so they go first.
  await db.execute(sql`
   DROP INDEX IF EXISTS "articles_search_vector_idx";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "search_vector";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "search_text";
  ALTER TABLE "_articles_v" DROP COLUMN IF EXISTS "version_search_text";`)
}
