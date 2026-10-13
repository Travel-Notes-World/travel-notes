import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "replies" ADD COLUMN "dislike_count" numeric DEFAULT 0;
  ALTER TABLE "replies" ADD COLUMN "score" numeric DEFAULT 0;
  ALTER TABLE "votes" ADD COLUMN "value" numeric DEFAULT 1 NOT NULL;
  CREATE INDEX "replies_score_idx" ON "replies" USING btree ("score");
  -- Every existing vote was a "helpful" mark, which is now a like.
  UPDATE "replies" SET "score" = COALESCE("helpful_count", 0), "dislike_count" = 0;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "replies_score_idx";
  ALTER TABLE "replies" DROP COLUMN "dislike_count";
  ALTER TABLE "replies" DROP COLUMN "score";
  ALTER TABLE "votes" DROP COLUMN "value";`)
}
