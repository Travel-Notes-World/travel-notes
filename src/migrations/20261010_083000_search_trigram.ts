import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Typo-tolerant search and suggestions as you type.
 *
 * pg_trgm compares text by three-letter pieces, so "Kyto" still matches "Kyoto". GIN trigram
 * indexes keep that fast on the columns searched: destination names and the titles of guides and
 * travel updates. They also speed up "starts with" (ILIKE 'kyo%') lookups.
 *
 * Safe to run twice. The extension itself is left in place on the way down: other code may use
 * it, and dropping an extension needs more rights than the app's database user may have.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX IF NOT EXISTS "destinations_name_trgm_idx" ON "destinations" USING GIN ("name" gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS "articles_title_trgm_idx" ON "articles" USING GIN ("title" gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS "travel_updates_title_trgm_idx" ON "travel_updates" USING GIN ("title" gin_trgm_ops);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "travel_updates_title_trgm_idx";
  DROP INDEX IF EXISTS "articles_title_trgm_idx";
  DROP INDEX IF EXISTS "destinations_name_trgm_idx";`)
}
