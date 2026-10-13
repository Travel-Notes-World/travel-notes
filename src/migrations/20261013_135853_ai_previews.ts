import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "ai_previews" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"visitor" varchar NOT NULL,
  	"query" varchar NOT NULL,
  	"summary" varchar,
  	"days" jsonb,
  	"paths" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ai_previews_id" uuid;
  CREATE UNIQUE INDEX "ai_previews_key_idx" ON "ai_previews" USING btree ("key");
  CREATE INDEX "ai_previews_visitor_idx" ON "ai_previews" USING btree ("visitor");
  CREATE INDEX "ai_previews_updated_at_idx" ON "ai_previews" USING btree ("updated_at");
  CREATE INDEX "ai_previews_created_at_idx" ON "ai_previews" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ai_previews_fk" FOREIGN KEY ("ai_previews_id") REFERENCES "public"."ai_previews"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_ai_previews_id_idx" ON "payload_locked_documents_rels" USING btree ("ai_previews_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "ai_previews" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "ai_previews" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ai_previews_fk";
  
  DROP INDEX "payload_locked_documents_rels_ai_previews_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ai_previews_id";`)
}
