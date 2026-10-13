import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_plans_ai_options_style" AS ENUM('budget', 'balanced', 'premium');
  CREATE TYPE "public"."enum_plans_days_stops_time_of_day" AS ENUM('morning', 'afternoon', 'evening');
  CREATE TYPE "public"."enum_plans_purpose" AS ENUM('holiday', 'visa', 'family', 'business');
  CREATE TYPE "public"."enum_plans_visa_funding" AS ENUM('self', 'family', 'employer', 'host', 'other');
  CREATE TYPE "public"."enum_plans_ai_tier" AS ENUM('brief', 'detailed');
  CREATE TYPE "public"."enum_ai_runs_kind" AS ENUM('brief', 'detailed', 'revision');
  CREATE TABLE "plans_ai_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"style" "enum_plans_ai_options_style" NOT NULL,
  	"summary" varchar,
  	"choices" varchar
  );
  
  CREATE TABLE "plans_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  ALTER TABLE "community_settings" ALTER COLUMN "planner_price_aud" SET DEFAULT 9.99;
  ALTER TABLE "_community_settings_v" ALTER COLUMN "version_planner_price_aud" SET DEFAULT 9.99;
  -- Added by hand: the AI planner was never switched on at the old price, so move the saved price to the new one.
  UPDATE "community_settings" SET "planner_price_aud" = 9.99 WHERE "planner_price_aud" = 4.99;
  ALTER TABLE "plans_days_stops" ADD COLUMN "time_of_day" "enum_plans_days_stops_time_of_day";
  ALTER TABLE "plans_days" ADD COLUMN "overnight" varchar;
  ALTER TABLE "plans_days" ADD COLUMN "overnight_confirmed" boolean DEFAULT false;
  ALTER TABLE "plans_days" ADD COLUMN "transport" varchar;
  ALTER TABLE "plans" ADD COLUMN "purpose" "enum_plans_purpose" DEFAULT 'holiday';
  ALTER TABLE "plans" ADD COLUMN "details_depart_from" varchar;
  ALTER TABLE "plans" ADD COLUMN "details_travellers" numeric;
  ALTER TABLE "plans" ADD COLUMN "details_budget_amount" numeric;
  ALTER TABLE "plans" ADD COLUMN "details_budget_currency" varchar;
  ALTER TABLE "plans" ADD COLUMN "details_accessibility" varchar;
  ALTER TABLE "plans" ADD COLUMN "visa_traveller_name" varchar;
  ALTER TABLE "plans" ADD COLUMN "visa_arrival_date" varchar;
  ALTER TABLE "plans" ADD COLUMN "visa_departure_date" varchar;
  ALTER TABLE "plans" ADD COLUMN "visa_cities" varchar;
  ALTER TABLE "plans" ADD COLUMN "visa_accommodation" varchar;
  ALTER TABLE "plans" ADD COLUMN "visa_transport" varchar;
  ALTER TABLE "plans" ADD COLUMN "visa_funding" "enum_plans_visa_funding";
  ALTER TABLE "plans" ADD COLUMN "visa_funding_note" varchar;
  ALTER TABLE "plans" ADD COLUMN "ai_tier" "enum_plans_ai_tier";
  ALTER TABLE "plans" ADD COLUMN "ai_revisions_used" numeric DEFAULT 0;
  ALTER TABLE "plans" ADD COLUMN "share_token" varchar;
  ALTER TABLE "plans" ADD COLUMN "share_enabled" boolean DEFAULT false;
  ALTER TABLE "ai_runs" ADD COLUMN "kind" "enum_ai_runs_kind" DEFAULT 'brief';
  ALTER TABLE "community_settings" ADD COLUMN "planner_revisions_per_plan" numeric DEFAULT 5;
  ALTER TABLE "_community_settings_v" ADD COLUMN "version_planner_revisions_per_plan" numeric DEFAULT 5;
  ALTER TABLE "plans_ai_options" ADD CONSTRAINT "plans_ai_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "plans_texts" ADD CONSTRAINT "plans_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "plans_ai_options_order_idx" ON "plans_ai_options" USING btree ("_order");
  CREATE INDEX "plans_ai_options_parent_id_idx" ON "plans_ai_options" USING btree ("_parent_id");
  CREATE INDEX "plans_texts_order_parent" ON "plans_texts" USING btree ("order","parent_id");
  CREATE UNIQUE INDEX "plans_share_share_token_idx" ON "plans" USING btree ("share_token");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "plans_ai_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "plans_texts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "plans_ai_options" CASCADE;
  DROP TABLE "plans_texts" CASCADE;
  DROP INDEX "plans_share_share_token_idx";
  ALTER TABLE "community_settings" ALTER COLUMN "planner_price_aud" SET DEFAULT 4.99;
  ALTER TABLE "_community_settings_v" ALTER COLUMN "version_planner_price_aud" SET DEFAULT 4.99;
  ALTER TABLE "plans_days_stops" DROP COLUMN "time_of_day";
  ALTER TABLE "plans_days" DROP COLUMN "overnight";
  ALTER TABLE "plans_days" DROP COLUMN "overnight_confirmed";
  ALTER TABLE "plans_days" DROP COLUMN "transport";
  ALTER TABLE "plans" DROP COLUMN "purpose";
  ALTER TABLE "plans" DROP COLUMN "details_depart_from";
  ALTER TABLE "plans" DROP COLUMN "details_travellers";
  ALTER TABLE "plans" DROP COLUMN "details_budget_amount";
  ALTER TABLE "plans" DROP COLUMN "details_budget_currency";
  ALTER TABLE "plans" DROP COLUMN "details_accessibility";
  ALTER TABLE "plans" DROP COLUMN "visa_traveller_name";
  ALTER TABLE "plans" DROP COLUMN "visa_arrival_date";
  ALTER TABLE "plans" DROP COLUMN "visa_departure_date";
  ALTER TABLE "plans" DROP COLUMN "visa_cities";
  ALTER TABLE "plans" DROP COLUMN "visa_accommodation";
  ALTER TABLE "plans" DROP COLUMN "visa_transport";
  ALTER TABLE "plans" DROP COLUMN "visa_funding";
  ALTER TABLE "plans" DROP COLUMN "visa_funding_note";
  ALTER TABLE "plans" DROP COLUMN "ai_tier";
  ALTER TABLE "plans" DROP COLUMN "ai_revisions_used";
  ALTER TABLE "plans" DROP COLUMN "share_token";
  ALTER TABLE "plans" DROP COLUMN "share_enabled";
  ALTER TABLE "ai_runs" DROP COLUMN "kind";
  ALTER TABLE "community_settings" DROP COLUMN "planner_revisions_per_plan";
  ALTER TABLE "_community_settings_v" DROP COLUMN "version_planner_revisions_per_plan";
  DROP TYPE "public"."enum_plans_ai_options_style";
  DROP TYPE "public"."enum_plans_days_stops_time_of_day";
  DROP TYPE "public"."enum_plans_purpose";
  DROP TYPE "public"."enum_plans_visa_funding";
  DROP TYPE "public"."enum_plans_ai_tier";
  DROP TYPE "public"."enum_ai_runs_kind";`)
}
