import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_reports_category" ADD VALUE 'sexual_content' BEFORE 'privacy';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "reports" ALTER COLUMN "category" SET DATA TYPE text;
  UPDATE "reports" SET "category" = 'other' WHERE "category" = 'sexual_content';
  DROP TYPE "public"."enum_reports_category";
  CREATE TYPE "public"."enum_reports_category" AS ENUM('spam', 'misleading_promotion', 'harassment', 'privacy', 'copyright', 'incorrect', 'event_problem', 'other');
  ALTER TABLE "reports" ALTER COLUMN "category" SET DATA TYPE "public"."enum_reports_category" USING "category"::"public"."enum_reports_category";`)
}
