import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_trips_status" AS ENUM('generating', 'ready', 'failed');
  ALTER TYPE "public"."enum_ai_runs_kind" ADD VALUE 'trip';
  ALTER TYPE "public"."enum_ai_runs_kind" ADD VALUE 'trip_prices';
  CREATE TABLE "trips" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"token" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"visitor" varchar NOT NULL,
  	"member_id" uuid,
  	"status" "enum_trips_status" DEFAULT 'generating' NOT NULL,
  	"error" varchar,
  	"attempts" numeric DEFAULT 0,
  	"started_at" timestamp(3) with time zone,
  	"form" jsonb NOT NULL,
  	"plan" jsonb,
  	"selection" jsonb,
  	"unlocked" boolean DEFAULT false,
  	"unlocked_at" timestamp(3) with time zone,
  	"payment_id" uuid,
  	"preview_hash" varchar,
  	"model" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "listing_payments" ADD COLUMN "trip_id" uuid;
  ALTER TABLE "ai_runs" ADD COLUMN "trip_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "trips_id" uuid;
  ALTER TABLE "trips" ADD CONSTRAINT "trips_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "trips" ADD CONSTRAINT "trips_payment_id_listing_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."listing_payments"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "trips_token_idx" ON "trips" USING btree ("token");
  CREATE INDEX "trips_visitor_idx" ON "trips" USING btree ("visitor");
  CREATE INDEX "trips_member_idx" ON "trips" USING btree ("member_id");
  CREATE INDEX "trips_unlocked_idx" ON "trips" USING btree ("unlocked");
  CREATE INDEX "trips_payment_idx" ON "trips" USING btree ("payment_id");
  CREATE INDEX "trips_updated_at_idx" ON "trips" USING btree ("updated_at");
  CREATE INDEX "trips_created_at_idx" ON "trips" USING btree ("created_at");
  CREATE INDEX "visitor_createdAt_idx" ON "trips" USING btree ("visitor","created_at");
  ALTER TABLE "listing_payments" ADD CONSTRAINT "listing_payments_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_trips_fk" FOREIGN KEY ("trips_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "listing_payments_trip_idx" ON "listing_payments" USING btree ("trip_id");
  CREATE INDEX "ai_runs_trip_idx" ON "ai_runs" USING btree ("trip_id");
  CREATE INDEX "payload_locked_documents_rels_trips_id_idx" ON "payload_locked_documents_rels" USING btree ("trips_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "trips" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "trips" CASCADE;
  ALTER TABLE "listing_payments" DROP CONSTRAINT "listing_payments_trip_id_trips_id_fk";
  
  ALTER TABLE "ai_runs" DROP CONSTRAINT "ai_runs_trip_id_trips_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_trips_fk";
  
  ALTER TABLE "ai_runs" ALTER COLUMN "kind" SET DATA TYPE text;
  ALTER TABLE "ai_runs" ALTER COLUMN "kind" SET DEFAULT 'brief'::text;
  DROP TYPE "public"."enum_ai_runs_kind";
  CREATE TYPE "public"."enum_ai_runs_kind" AS ENUM('brief', 'detailed', 'revision', 'research');
  ALTER TABLE "ai_runs" ALTER COLUMN "kind" SET DEFAULT 'brief'::"public"."enum_ai_runs_kind";
  ALTER TABLE "ai_runs" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_ai_runs_kind" USING "kind"::"public"."enum_ai_runs_kind";
  DROP INDEX "listing_payments_trip_idx";
  DROP INDEX "ai_runs_trip_idx";
  DROP INDEX "payload_locked_documents_rels_trips_id_idx";
  ALTER TABLE "listing_payments" DROP COLUMN "trip_id";
  ALTER TABLE "ai_runs" DROP COLUMN "trip_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "trips_id";
  DROP TYPE "public"."enum_trips_status";`)
}
