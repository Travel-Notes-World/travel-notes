import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "community_settings" ADD COLUMN "review_smart_publish" boolean DEFAULT true;
  ALTER TABLE "community_settings" ADD COLUMN "review_smart_publish_min_approved" numeric DEFAULT 1;
  ALTER TABLE "community_settings" ADD COLUMN "review_auto_hide_reports" numeric DEFAULT 3;
  ALTER TABLE "_community_settings_v" ADD COLUMN "version_review_smart_publish" boolean DEFAULT true;
  ALTER TABLE "_community_settings_v" ADD COLUMN "version_review_smart_publish_min_approved" numeric DEFAULT 1;
  ALTER TABLE "_community_settings_v" ADD COLUMN "version_review_auto_hide_reports" numeric DEFAULT 3;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "community_settings" DROP COLUMN "review_smart_publish";
  ALTER TABLE "community_settings" DROP COLUMN "review_smart_publish_min_approved";
  ALTER TABLE "community_settings" DROP COLUMN "review_auto_hide_reports";
  ALTER TABLE "_community_settings_v" DROP COLUMN "version_review_smart_publish";
  ALTER TABLE "_community_settings_v" DROP COLUMN "version_review_smart_publish_min_approved";
  ALTER TABLE "_community_settings_v" DROP COLUMN "version_review_auto_hide_reports";`)
}
