import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Safe to run on a database that already has the table: an earlier version of this change was
  // applied to the preview database before it was regenerated. Production never had it.
  await db.execute(sql`
  DO $$ BEGIN CREATE TYPE "public"."enum_newsletter_subscribers_status" AS ENUM('pending', 'confirmed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_newsletter_subscribers_sync_status" AS ENUM('not-needed', 'pending', 'synced', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  CREATE TABLE IF NOT EXISTS "newsletter_subscribers" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"email" varchar NOT NULL,
  	"status" "enum_newsletter_subscribers_status" DEFAULT 'pending' NOT NULL,
  	"requested_at" timestamp(3) with time zone NOT NULL,
  	"confirmed_at" timestamp(3) with time zone,
  	"source" varchar,
  	"token_hash" varchar,
  	"token_expires_at" timestamp(3) with time zone,
  	"sync_status" "enum_newsletter_subscribers_sync_status" DEFAULT 'not-needed' NOT NULL,
  	"sync_attempts" numeric DEFAULT 0 NOT NULL,
  	"sync_error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "newsletter_subscribers_id" uuid;
  CREATE UNIQUE INDEX IF NOT EXISTS "newsletter_subscribers_email_idx" ON "newsletter_subscribers" USING btree ("email");
  CREATE INDEX IF NOT EXISTS "newsletter_subscribers_status_idx" ON "newsletter_subscribers" USING btree ("status");
  CREATE INDEX IF NOT EXISTS "newsletter_subscribers_token_hash_idx" ON "newsletter_subscribers" USING btree ("token_hash");
  CREATE INDEX IF NOT EXISTS "newsletter_subscribers_sync_status_idx" ON "newsletter_subscribers" USING btree ("sync_status");
  CREATE INDEX IF NOT EXISTS "newsletter_subscribers_updated_at_idx" ON "newsletter_subscribers" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "newsletter_subscribers_created_at_idx" ON "newsletter_subscribers" USING btree ("created_at");
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_newsletter_subscribers_fk" FOREIGN KEY ("newsletter_subscribers_id") REFERENCES "public"."newsletter_subscribers"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_newsletter_subscribers_id_idx" ON "payload_locked_documents_rels" USING btree ("newsletter_subscribers_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Written by hand: the generated version dropped the table before the link that points to it.
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_newsletter_subscribers_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_newsletter_subscribers_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "newsletter_subscribers_id";
  DROP TABLE IF EXISTS "newsletter_subscribers" CASCADE;
  DROP TYPE IF EXISTS "public"."enum_newsletter_subscribers_status";
  DROP TYPE IF EXISTS "public"."enum_newsletter_subscribers_sync_status";`)
}
