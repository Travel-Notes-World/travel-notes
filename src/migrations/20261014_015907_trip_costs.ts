import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_price_checks_item" AS ENUM('breakfast', 'lunch', 'dinner', 'coffee', 'snacks', 'water', 'local_transport', 'airport_transfer', 'intercity', 'stay_budget', 'stay_mid', 'stay_premium', 'attraction', 'tour', 'mobile_data');
  CREATE TYPE "public"."enum_price_checks_basis" AS ENUM('person', 'room_night', 'item', 'journey', 'group');
  CREATE TYPE "public"."enum_price_checks_kind" AS ENUM('published', 'quote', 'estimate');
  CREATE TYPE "public"."enum_price_checks_status" AS ENUM('active', 'review', 'retired');
  CREATE TYPE "public"."enum_travel_advisories_level" AS ENUM('1', '2', '3', '4');
  CREATE TABLE "price_checks" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"destination_id" uuid NOT NULL,
  	"item" "enum_price_checks_item" NOT NULL,
  	"name" varchar,
  	"to_destination_id" uuid,
  	"amount" numeric NOT NULL,
  	"amount_high" numeric,
  	"currency" varchar DEFAULT 'AUD' NOT NULL,
  	"basis" "enum_price_checks_basis" NOT NULL,
  	"child_amount" numeric,
  	"child_amount_high" numeric,
  	"child_max_age" numeric,
  	"free_under_age" numeric,
  	"kind" "enum_price_checks_kind" DEFAULT 'published' NOT NULL,
  	"source_name" varchar NOT NULL,
  	"source_url" varchar NOT NULL,
  	"checked_at" timestamp(3) with time zone NOT NULL,
  	"includes" varchar,
  	"excludes" varchar,
  	"booking_url" varchar,
  	"status" "enum_price_checks_status" DEFAULT 'active' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "travel_advisories" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"country_id" uuid NOT NULL,
  	"country_name" varchar,
  	"level" "enum_travel_advisories_level" NOT NULL,
  	"note" varchar,
  	"url" varchar NOT NULL,
  	"checked_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "plans" ADD COLUMN "trip" jsonb;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "price_checks_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "travel_advisories_id" uuid;
  ALTER TABLE "price_checks" ADD CONSTRAINT "price_checks_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "price_checks" ADD CONSTRAINT "price_checks_to_destination_id_destinations_id_fk" FOREIGN KEY ("to_destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "travel_advisories" ADD CONSTRAINT "travel_advisories_country_id_destinations_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "price_checks_destination_idx" ON "price_checks" USING btree ("destination_id");
  CREATE INDEX "price_checks_to_destination_idx" ON "price_checks" USING btree ("to_destination_id");
  CREATE INDEX "price_checks_updated_at_idx" ON "price_checks" USING btree ("updated_at");
  CREATE INDEX "price_checks_created_at_idx" ON "price_checks" USING btree ("created_at");
  CREATE INDEX "destination_item_idx" ON "price_checks" USING btree ("destination_id","item");
  CREATE UNIQUE INDEX "travel_advisories_country_idx" ON "travel_advisories" USING btree ("country_id");
  CREATE INDEX "travel_advisories_updated_at_idx" ON "travel_advisories" USING btree ("updated_at");
  CREATE INDEX "travel_advisories_created_at_idx" ON "travel_advisories" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_price_checks_fk" FOREIGN KEY ("price_checks_id") REFERENCES "public"."price_checks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_travel_advisories_fk" FOREIGN KEY ("travel_advisories_id") REFERENCES "public"."travel_advisories"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_price_checks_id_idx" ON "payload_locked_documents_rels" USING btree ("price_checks_id");
  CREATE INDEX "payload_locked_documents_rels_travel_advisories_id_idx" ON "payload_locked_documents_rels" USING btree ("travel_advisories_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "price_checks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "travel_advisories" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "price_checks" CASCADE;
  DROP TABLE "travel_advisories" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_price_checks_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_travel_advisories_fk";
  
  DROP INDEX "payload_locked_documents_rels_price_checks_id_idx";
  DROP INDEX "payload_locked_documents_rels_travel_advisories_id_idx";
  ALTER TABLE "plans" DROP COLUMN "trip";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "price_checks_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "travel_advisories_id";
  DROP TYPE "public"."enum_price_checks_item";
  DROP TYPE "public"."enum_price_checks_basis";
  DROP TYPE "public"."enum_price_checks_kind";
  DROP TYPE "public"."enum_price_checks_status";
  DROP TYPE "public"."enum_travel_advisories_level";`)
}
