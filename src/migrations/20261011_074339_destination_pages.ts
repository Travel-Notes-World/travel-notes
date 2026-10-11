import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_destinations_best_months" AS ENUM('jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec');
  CREATE TYPE "public"."enum_destinations_good_months" AS ENUM('jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec');
  CREATE TYPE "public"."enum_destinations_facts_kind" AS ENUM('visa', 'advice', 'health', 'emergency', 'currency', 'language', 'plugs', 'driving', 'tipping', 'water', 'flights', 'other');
  CREATE TYPE "public"."enum__destinations_v_version_best_months" AS ENUM('jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec');
  CREATE TYPE "public"."enum__destinations_v_version_good_months" AS ENUM('jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec');
  CREATE TYPE "public"."enum__destinations_v_version_facts_kind" AS ENUM('visa', 'advice', 'health', 'emergency', 'currency', 'language', 'plugs', 'driving', 'tipping', 'water', 'flights', 'other');
  CREATE TYPE "public"."enum_images_licence" AS ENUM('own', 'permission', 'cc-by', 'cc-by-sa', 'cc0');
  CREATE TABLE "destinations_best_months" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum_destinations_best_months",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );
  
  CREATE TABLE "destinations_good_months" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum_destinations_good_months",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );
  
  CREATE TABLE "destinations_facts" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"kind" "enum_destinations_facts_kind",
  	"label" varchar,
  	"value" varchar,
  	"source_name" varchar,
  	"source_url" varchar
  );
  
  CREATE TABLE "destinations_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"url" varchar
  );
  
  CREATE TABLE "destinations_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar
  );
  
  CREATE TABLE "_destinations_v_version_best_months" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum__destinations_v_version_best_months",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );
  
  CREATE TABLE "_destinations_v_version_good_months" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum__destinations_v_version_good_months",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );
  
  CREATE TABLE "_destinations_v_version_facts" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"kind" "enum__destinations_v_version_facts_kind",
  	"label" varchar,
  	"value" varchar,
  	"source_name" varchar,
  	"source_url" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_destinations_v_version_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar,
  	"url" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_destinations_v_version_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"question" varchar,
  	"answer" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "images" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"alt" varchar NOT NULL,
  	"caption" varchar,
  	"credit" varchar NOT NULL,
  	"licence" "enum_images_licence" NOT NULL,
  	"licence_url" varchar,
  	"source_url" varchar,
  	"rights_confirmed" boolean DEFAULT false NOT NULL,
  	"_objectkey" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumb_url" varchar,
  	"sizes_thumb_width" numeric,
  	"sizes_thumb_height" numeric,
  	"sizes_thumb_mime_type" varchar,
  	"sizes_thumb_filesize" numeric,
  	"sizes_thumb_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_large_url" varchar,
  	"sizes_large_width" numeric,
  	"sizes_large_height" numeric,
  	"sizes_large_mime_type" varchar,
  	"sizes_large_filesize" numeric,
  	"sizes_large_filename" varchar
  );
  
  ALTER TABLE "destinations" ADD COLUMN "hero_image_id" uuid;
  ALTER TABLE "destinations" ADD COLUMN "good_for" varchar;
  ALTER TABLE "destinations" ADD COLUMN "time_needed" varchar;
  ALTER TABLE "destinations" ADD COLUMN "author_id" uuid;
  ALTER TABLE "destinations" ADD COLUMN "when_to_go" varchar;
  ALTER TABLE "destinations" ADD COLUMN "facts_checked_at" timestamp(3) with time zone;
  ALTER TABLE "_destinations_v" ADD COLUMN "version_hero_image_id" uuid;
  ALTER TABLE "_destinations_v" ADD COLUMN "version_good_for" varchar;
  ALTER TABLE "_destinations_v" ADD COLUMN "version_time_needed" varchar;
  ALTER TABLE "_destinations_v" ADD COLUMN "version_author_id" uuid;
  ALTER TABLE "_destinations_v" ADD COLUMN "version_when_to_go" varchar;
  ALTER TABLE "_destinations_v" ADD COLUMN "version_facts_checked_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "images_id" uuid;
  ALTER TABLE "destinations_best_months" ADD CONSTRAINT "destinations_best_months_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "destinations_good_months" ADD CONSTRAINT "destinations_good_months_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "destinations_facts" ADD CONSTRAINT "destinations_facts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "destinations_sources" ADD CONSTRAINT "destinations_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "destinations_faqs" ADD CONSTRAINT "destinations_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_destinations_v_version_best_months" ADD CONSTRAINT "_destinations_v_version_best_months_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_destinations_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_destinations_v_version_good_months" ADD CONSTRAINT "_destinations_v_version_good_months_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_destinations_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_destinations_v_version_facts" ADD CONSTRAINT "_destinations_v_version_facts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_destinations_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_destinations_v_version_sources" ADD CONSTRAINT "_destinations_v_version_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_destinations_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_destinations_v_version_faqs" ADD CONSTRAINT "_destinations_v_version_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_destinations_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "destinations_best_months_order_idx" ON "destinations_best_months" USING btree ("order");
  CREATE INDEX "destinations_best_months_parent_idx" ON "destinations_best_months" USING btree ("parent_id");
  CREATE INDEX "destinations_good_months_order_idx" ON "destinations_good_months" USING btree ("order");
  CREATE INDEX "destinations_good_months_parent_idx" ON "destinations_good_months" USING btree ("parent_id");
  CREATE INDEX "destinations_facts_order_idx" ON "destinations_facts" USING btree ("_order");
  CREATE INDEX "destinations_facts_parent_id_idx" ON "destinations_facts" USING btree ("_parent_id");
  CREATE INDEX "destinations_sources_order_idx" ON "destinations_sources" USING btree ("_order");
  CREATE INDEX "destinations_sources_parent_id_idx" ON "destinations_sources" USING btree ("_parent_id");
  CREATE INDEX "destinations_faqs_order_idx" ON "destinations_faqs" USING btree ("_order");
  CREATE INDEX "destinations_faqs_parent_id_idx" ON "destinations_faqs" USING btree ("_parent_id");
  CREATE INDEX "_destinations_v_version_best_months_order_idx" ON "_destinations_v_version_best_months" USING btree ("order");
  CREATE INDEX "_destinations_v_version_best_months_parent_idx" ON "_destinations_v_version_best_months" USING btree ("parent_id");
  CREATE INDEX "_destinations_v_version_good_months_order_idx" ON "_destinations_v_version_good_months" USING btree ("order");
  CREATE INDEX "_destinations_v_version_good_months_parent_idx" ON "_destinations_v_version_good_months" USING btree ("parent_id");
  CREATE INDEX "_destinations_v_version_facts_order_idx" ON "_destinations_v_version_facts" USING btree ("_order");
  CREATE INDEX "_destinations_v_version_facts_parent_id_idx" ON "_destinations_v_version_facts" USING btree ("_parent_id");
  CREATE INDEX "_destinations_v_version_sources_order_idx" ON "_destinations_v_version_sources" USING btree ("_order");
  CREATE INDEX "_destinations_v_version_sources_parent_id_idx" ON "_destinations_v_version_sources" USING btree ("_parent_id");
  CREATE INDEX "_destinations_v_version_faqs_order_idx" ON "_destinations_v_version_faqs" USING btree ("_order");
  CREATE INDEX "_destinations_v_version_faqs_parent_id_idx" ON "_destinations_v_version_faqs" USING btree ("_parent_id");
  CREATE INDEX "images_updated_at_idx" ON "images" USING btree ("updated_at");
  CREATE INDEX "images_created_at_idx" ON "images" USING btree ("created_at");
  CREATE UNIQUE INDEX "images_filename_idx" ON "images" USING btree ("filename");
  CREATE INDEX "images_sizes_thumb_sizes_thumb_filename_idx" ON "images" USING btree ("sizes_thumb_filename");
  CREATE INDEX "images_sizes_card_sizes_card_filename_idx" ON "images" USING btree ("sizes_card_filename");
  CREATE INDEX "images_sizes_large_sizes_large_filename_idx" ON "images" USING btree ("sizes_large_filename");
  ALTER TABLE "destinations" ADD CONSTRAINT "destinations_hero_image_id_images_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "destinations" ADD CONSTRAINT "destinations_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_destinations_v" ADD CONSTRAINT "_destinations_v_version_hero_image_id_images_id_fk" FOREIGN KEY ("version_hero_image_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_destinations_v" ADD CONSTRAINT "_destinations_v_version_author_id_authors_id_fk" FOREIGN KEY ("version_author_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_images_fk" FOREIGN KEY ("images_id") REFERENCES "public"."images"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "destinations_hero_image_idx" ON "destinations" USING btree ("hero_image_id");
  CREATE INDEX "destinations_author_idx" ON "destinations" USING btree ("author_id");
  CREATE INDEX "_destinations_v_version_version_hero_image_idx" ON "_destinations_v" USING btree ("version_hero_image_id");
  CREATE INDEX "_destinations_v_version_version_author_idx" ON "_destinations_v" USING btree ("version_author_id");
  CREATE INDEX "payload_locked_documents_rels_images_id_idx" ON "payload_locked_documents_rels" USING btree ("images_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "destinations" DROP CONSTRAINT IF EXISTS "destinations_hero_image_id_images_id_fk";
  ALTER TABLE "destinations" DROP CONSTRAINT IF EXISTS "destinations_author_id_authors_id_fk";
  ALTER TABLE "_destinations_v" DROP CONSTRAINT IF EXISTS "_destinations_v_version_hero_image_id_images_id_fk";
  ALTER TABLE "_destinations_v" DROP CONSTRAINT IF EXISTS "_destinations_v_version_author_id_authors_id_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_images_fk";
  
   ALTER TABLE "destinations_best_months" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "destinations_good_months" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "destinations_facts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "destinations_sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "destinations_faqs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_destinations_v_version_best_months" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_destinations_v_version_good_months" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_destinations_v_version_facts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_destinations_v_version_sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_destinations_v_version_faqs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "images" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "destinations_best_months" CASCADE;
  DROP TABLE "destinations_good_months" CASCADE;
  DROP TABLE "destinations_facts" CASCADE;
  DROP TABLE "destinations_sources" CASCADE;
  DROP TABLE "destinations_faqs" CASCADE;
  DROP TABLE "_destinations_v_version_best_months" CASCADE;
  DROP TABLE "_destinations_v_version_good_months" CASCADE;
  DROP TABLE "_destinations_v_version_facts" CASCADE;
  DROP TABLE "_destinations_v_version_sources" CASCADE;
  DROP TABLE "_destinations_v_version_faqs" CASCADE;
  DROP TABLE "images" CASCADE;
  
  
  
  
  
  DROP INDEX "destinations_hero_image_idx";
  DROP INDEX "destinations_author_idx";
  DROP INDEX "_destinations_v_version_version_hero_image_idx";
  DROP INDEX "_destinations_v_version_version_author_idx";
  DROP INDEX "payload_locked_documents_rels_images_id_idx";
  ALTER TABLE "destinations" DROP COLUMN "hero_image_id";
  ALTER TABLE "destinations" DROP COLUMN "good_for";
  ALTER TABLE "destinations" DROP COLUMN "time_needed";
  ALTER TABLE "destinations" DROP COLUMN "author_id";
  ALTER TABLE "destinations" DROP COLUMN "when_to_go";
  ALTER TABLE "destinations" DROP COLUMN "facts_checked_at";
  ALTER TABLE "_destinations_v" DROP COLUMN "version_hero_image_id";
  ALTER TABLE "_destinations_v" DROP COLUMN "version_good_for";
  ALTER TABLE "_destinations_v" DROP COLUMN "version_time_needed";
  ALTER TABLE "_destinations_v" DROP COLUMN "version_author_id";
  ALTER TABLE "_destinations_v" DROP COLUMN "version_when_to_go";
  ALTER TABLE "_destinations_v" DROP COLUMN "version_facts_checked_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "images_id";
  DROP TYPE "public"."enum_destinations_best_months";
  DROP TYPE "public"."enum_destinations_good_months";
  DROP TYPE "public"."enum_destinations_facts_kind";
  DROP TYPE "public"."enum__destinations_v_version_best_months";
  DROP TYPE "public"."enum__destinations_v_version_good_months";
  DROP TYPE "public"."enum__destinations_v_version_facts_kind";
  DROP TYPE "public"."enum_images_licence";`)
}
