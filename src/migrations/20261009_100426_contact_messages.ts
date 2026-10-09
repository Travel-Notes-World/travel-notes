import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_contact_messages_topic" AS ENUM('general', 'correction', 'advertising', 'pitch', 'privacy', 'other');
  CREATE TYPE "public"."enum_contact_messages_status" AS ENUM('new', 'handled', 'spam');
  CREATE TYPE "public"."enum_contact_messages_email_status" AS ENUM('pending', 'sent', 'captured', 'failed');
  CREATE TABLE "contact_messages" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"subject" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"topic" "enum_contact_messages_topic" NOT NULL,
  	"page_url" varchar,
  	"message" varchar NOT NULL,
  	"status" "enum_contact_messages_status" DEFAULT 'new' NOT NULL,
  	"note" varchar,
  	"email_status" "enum_contact_messages_email_status" DEFAULT 'pending' NOT NULL,
  	"email_attempts" numeric DEFAULT 0 NOT NULL,
  	"email_error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "contact_messages_id" uuid;
  CREATE INDEX "contact_messages_status_idx" ON "contact_messages" USING btree ("status");
  CREATE INDEX "contact_messages_email_status_idx" ON "contact_messages" USING btree ("email_status");
  CREATE INDEX "contact_messages_updated_at_idx" ON "contact_messages" USING btree ("updated_at");
  CREATE INDEX "contact_messages_created_at_idx" ON "contact_messages" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_contact_messages_fk" FOREIGN KEY ("contact_messages_id") REFERENCES "public"."contact_messages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_contact_messages_id_idx" ON "payload_locked_documents_rels" USING btree ("contact_messages_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Written by hand: the generated version dropped the table before the link that points to it.
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_contact_messages_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_contact_messages_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "contact_messages_id";
  DROP TABLE IF EXISTS "contact_messages" CASCADE;
  DROP TYPE IF EXISTS "public"."enum_contact_messages_topic";
  DROP TYPE IF EXISTS "public"."enum_contact_messages_status";
  DROP TYPE IF EXISTS "public"."enum_contact_messages_email_status";`)
}
