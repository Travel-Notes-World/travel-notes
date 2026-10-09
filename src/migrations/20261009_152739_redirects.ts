import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Safe to run twice: the preview database already has these objects from an earlier build of
  // this branch (under an older migration name), so every step checks before it creates.
  await db.execute(sql`
   DO $$ BEGIN
    CREATE TYPE "public"."enum_redirects_type" AS ENUM('permanent', 'temporary', 'gone');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_redirects_source" AS ENUM('manual', 'automatic');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  CREATE TABLE IF NOT EXISTS "redirects" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"from" varchar NOT NULL,
  	"type" "enum_redirects_type" DEFAULT 'permanent' NOT NULL,
  	"to" varchar,
  	"source" "enum_redirects_source" DEFAULT 'manual',
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "redirects_id" uuid;
  CREATE UNIQUE INDEX IF NOT EXISTS "redirects_from_idx" ON "redirects" USING btree ("from");
  CREATE INDEX IF NOT EXISTS "redirects_updated_at_idx" ON "redirects" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "redirects_created_at_idx" ON "redirects" USING btree ("created_at");
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_redirects_fk" FOREIGN KEY ("redirects_id") REFERENCES "public"."redirects"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_redirects_id_idx" ON "payload_locked_documents_rels" USING btree ("redirects_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Remove the reference from payload_locked_documents_rels first, then the table it points at.
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_redirects_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_redirects_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "redirects_id";
  DROP TABLE IF EXISTS "redirects" CASCADE;
  DROP TYPE IF EXISTS "public"."enum_redirects_type";
  DROP TYPE IF EXISTS "public"."enum_redirects_source";`)
}
