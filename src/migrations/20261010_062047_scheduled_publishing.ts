import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "publish_at" timestamp(3) with time zone;
  ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "schedule_note" varchar;
  ALTER TABLE "_articles_v" ADD COLUMN IF NOT EXISTS "version_publish_at" timestamp(3) with time zone;
  ALTER TABLE "_articles_v" ADD COLUMN IF NOT EXISTS "version_schedule_note" varchar;
  ALTER TABLE "travel_updates" ADD COLUMN IF NOT EXISTS "publish_at" timestamp(3) with time zone;
  ALTER TABLE "travel_updates" ADD COLUMN IF NOT EXISTS "schedule_note" varchar;
  ALTER TABLE "_travel_updates_v" ADD COLUMN IF NOT EXISTS "version_publish_at" timestamp(3) with time zone;
  ALTER TABLE "_travel_updates_v" ADD COLUMN IF NOT EXISTS "version_schedule_note" varchar;
  CREATE INDEX IF NOT EXISTS "articles_publish_at_idx" ON "articles" USING btree ("publish_at");
  CREATE INDEX IF NOT EXISTS "_articles_v_version_version_publish_at_idx" ON "_articles_v" USING btree ("version_publish_at");
  CREATE INDEX IF NOT EXISTS "travel_updates_publish_at_idx" ON "travel_updates" USING btree ("publish_at");
  CREATE INDEX IF NOT EXISTS "_travel_updates_v_version_version_publish_at_idx" ON "_travel_updates_v" USING btree ("version_publish_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "articles_publish_at_idx";
  DROP INDEX IF EXISTS "_articles_v_version_version_publish_at_idx";
  DROP INDEX IF EXISTS "travel_updates_publish_at_idx";
  DROP INDEX IF EXISTS "_travel_updates_v_version_version_publish_at_idx";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "publish_at";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "schedule_note";
  ALTER TABLE "_articles_v" DROP COLUMN IF EXISTS "version_publish_at";
  ALTER TABLE "_articles_v" DROP COLUMN IF EXISTS "version_schedule_note";
  ALTER TABLE "travel_updates" DROP COLUMN IF EXISTS "publish_at";
  ALTER TABLE "travel_updates" DROP COLUMN IF EXISTS "schedule_note";
  ALTER TABLE "_travel_updates_v" DROP COLUMN IF EXISTS "version_publish_at";
  ALTER TABLE "_travel_updates_v" DROP COLUMN IF EXISTS "version_schedule_note";`)
}
