import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_travel_updates_category" AS ENUM('entry-rules', 'flights-routes', 'closures', 'safety', 'fees', 'events', 'other');
  CREATE TYPE "public"."enum_travel_updates_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__travel_updates_v_version_category" AS ENUM('entry-rules', 'flights-routes', 'closures', 'safety', 'fees', 'events', 'other');
  CREATE TYPE "public"."enum__travel_updates_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "travel_updates_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"url" varchar
  );
  
  CREATE TABLE "travel_updates" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"title" varchar,
  	"summary" varchar,
  	"body" jsonb,
  	"update_note" varchar,
  	"slug" varchar,
  	"category" "enum_travel_updates_category",
  	"affects_australians" boolean DEFAULT false,
  	"author_id" uuid,
  	"effective_date" timestamp(3) with time zone,
  	"end_date" timestamp(3) with time zone,
  	"first_published_at" timestamp(3) with time zone,
  	"editorial_updated_at" timestamp(3) with time zone,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_noindex" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_travel_updates_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "travel_updates_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"destinations_id" uuid
  );
  
  CREATE TABLE "_travel_updates_v_version_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar,
  	"url" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_travel_updates_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_title" varchar,
  	"version_summary" varchar,
  	"version_body" jsonb,
  	"version_update_note" varchar,
  	"version_slug" varchar,
  	"version_category" "enum__travel_updates_v_version_category",
  	"version_affects_australians" boolean DEFAULT false,
  	"version_author_id" uuid,
  	"version_effective_date" timestamp(3) with time zone,
  	"version_end_date" timestamp(3) with time zone,
  	"version_first_published_at" timestamp(3) with time zone,
  	"version_editorial_updated_at" timestamp(3) with time zone,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_noindex" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__travel_updates_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_travel_updates_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"destinations_id" uuid
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "travel_updates_id" uuid;
  ALTER TABLE "travel_updates_sources" ADD CONSTRAINT "travel_updates_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."travel_updates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "travel_updates" ADD CONSTRAINT "travel_updates_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "travel_updates_rels" ADD CONSTRAINT "travel_updates_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."travel_updates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "travel_updates_rels" ADD CONSTRAINT "travel_updates_rels_destinations_fk" FOREIGN KEY ("destinations_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_travel_updates_v_version_sources" ADD CONSTRAINT "_travel_updates_v_version_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_travel_updates_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_travel_updates_v" ADD CONSTRAINT "_travel_updates_v_parent_id_travel_updates_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."travel_updates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_travel_updates_v" ADD CONSTRAINT "_travel_updates_v_version_author_id_authors_id_fk" FOREIGN KEY ("version_author_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_travel_updates_v_rels" ADD CONSTRAINT "_travel_updates_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_travel_updates_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_travel_updates_v_rels" ADD CONSTRAINT "_travel_updates_v_rels_destinations_fk" FOREIGN KEY ("destinations_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "travel_updates_sources_order_idx" ON "travel_updates_sources" USING btree ("_order");
  CREATE INDEX "travel_updates_sources_parent_id_idx" ON "travel_updates_sources" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "travel_updates_slug_idx" ON "travel_updates" USING btree ("slug");
  CREATE INDEX "travel_updates_affects_australians_idx" ON "travel_updates" USING btree ("affects_australians");
  CREATE INDEX "travel_updates_author_idx" ON "travel_updates" USING btree ("author_id");
  CREATE INDEX "travel_updates_first_published_at_idx" ON "travel_updates" USING btree ("first_published_at");
  CREATE INDEX "travel_updates_updated_at_idx" ON "travel_updates" USING btree ("updated_at");
  CREATE INDEX "travel_updates_created_at_idx" ON "travel_updates" USING btree ("created_at");
  CREATE INDEX "travel_updates__status_idx" ON "travel_updates" USING btree ("_status");
  CREATE INDEX "travel_updates_rels_order_idx" ON "travel_updates_rels" USING btree ("order");
  CREATE INDEX "travel_updates_rels_parent_idx" ON "travel_updates_rels" USING btree ("parent_id");
  CREATE INDEX "travel_updates_rels_path_idx" ON "travel_updates_rels" USING btree ("path");
  CREATE INDEX "travel_updates_rels_destinations_id_idx" ON "travel_updates_rels" USING btree ("destinations_id");
  CREATE INDEX "_travel_updates_v_version_sources_order_idx" ON "_travel_updates_v_version_sources" USING btree ("_order");
  CREATE INDEX "_travel_updates_v_version_sources_parent_id_idx" ON "_travel_updates_v_version_sources" USING btree ("_parent_id");
  CREATE INDEX "_travel_updates_v_parent_idx" ON "_travel_updates_v" USING btree ("parent_id");
  CREATE INDEX "_travel_updates_v_version_version_slug_idx" ON "_travel_updates_v" USING btree ("version_slug");
  CREATE INDEX "_travel_updates_v_version_version_affects_australians_idx" ON "_travel_updates_v" USING btree ("version_affects_australians");
  CREATE INDEX "_travel_updates_v_version_version_author_idx" ON "_travel_updates_v" USING btree ("version_author_id");
  CREATE INDEX "_travel_updates_v_version_version_first_published_at_idx" ON "_travel_updates_v" USING btree ("version_first_published_at");
  CREATE INDEX "_travel_updates_v_version_version_updated_at_idx" ON "_travel_updates_v" USING btree ("version_updated_at");
  CREATE INDEX "_travel_updates_v_version_version_created_at_idx" ON "_travel_updates_v" USING btree ("version_created_at");
  CREATE INDEX "_travel_updates_v_version_version__status_idx" ON "_travel_updates_v" USING btree ("version__status");
  CREATE INDEX "_travel_updates_v_created_at_idx" ON "_travel_updates_v" USING btree ("created_at");
  CREATE INDEX "_travel_updates_v_updated_at_idx" ON "_travel_updates_v" USING btree ("updated_at");
  CREATE INDEX "_travel_updates_v_latest_idx" ON "_travel_updates_v" USING btree ("latest");
  CREATE INDEX "_travel_updates_v_rels_order_idx" ON "_travel_updates_v_rels" USING btree ("order");
  CREATE INDEX "_travel_updates_v_rels_parent_idx" ON "_travel_updates_v_rels" USING btree ("parent_id");
  CREATE INDEX "_travel_updates_v_rels_path_idx" ON "_travel_updates_v_rels" USING btree ("path");
  CREATE INDEX "_travel_updates_v_rels_destinations_id_idx" ON "_travel_updates_v_rels" USING btree ("destinations_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_travel_updates_fk" FOREIGN KEY ("travel_updates_id") REFERENCES "public"."travel_updates"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_travel_updates_id_idx" ON "payload_locked_documents_rels" USING btree ("travel_updates_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // The reference from payload_locked_documents_rels goes first, then the tables, then the types.
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_travel_updates_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_travel_updates_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "travel_updates_id";
  DROP TABLE IF EXISTS "_travel_updates_v_rels" CASCADE;
  DROP TABLE IF EXISTS "_travel_updates_v_version_sources" CASCADE;
  DROP TABLE IF EXISTS "_travel_updates_v" CASCADE;
  DROP TABLE IF EXISTS "travel_updates_rels" CASCADE;
  DROP TABLE IF EXISTS "travel_updates_sources" CASCADE;
  DROP TABLE IF EXISTS "travel_updates" CASCADE;
  DROP TYPE IF EXISTS "public"."enum_travel_updates_category";
  DROP TYPE IF EXISTS "public"."enum_travel_updates_status";
  DROP TYPE IF EXISTS "public"."enum__travel_updates_v_version_category";
  DROP TYPE IF EXISTS "public"."enum__travel_updates_v_version_status";`)
}
