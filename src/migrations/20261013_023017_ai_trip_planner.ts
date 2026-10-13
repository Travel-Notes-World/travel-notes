import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_plans_days_stops_origin" AS ENUM('own', 'travel_notes', 'ai_idea');
  CREATE TYPE "public"."enum_listing_payments_purpose" AS ENUM('listing', 'ai_plan');
  CREATE TYPE "public"."enum_ai_runs_status" AS ENUM('started', 'ok', 'failed');
  CREATE TYPE "public"."enum_community_settings_planner_model" AS ENUM('claude-sonnet-5-5', 'claude-haiku-5-5');
  CREATE TYPE "public"."enum__community_settings_v_version_planner_model" AS ENUM('claude-sonnet-5-5', 'claude-haiku-5-5');
  CREATE TABLE "ai_runs" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"member_id" uuid,
  	"plan_id" uuid,
  	"status" "enum_ai_runs_status" DEFAULT 'started' NOT NULL,
  	"model" varchar NOT NULL,
  	"free" boolean DEFAULT false,
  	"payment_id" uuid,
  	"input_tokens" numeric DEFAULT 0,
  	"output_tokens" numeric DEFAULT 0,
  	"cost_micro_usd" numeric DEFAULT 0,
  	"error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "plans_days_stops" ADD COLUMN "origin" "enum_plans_days_stops_origin" DEFAULT 'own';
  ALTER TABLE "plans_days_stops" ADD COLUMN "source_path" varchar;
  ALTER TABLE "plans" ADD COLUMN "ai_generated_at" timestamp(3) with time zone;
  ALTER TABLE "plans" ADD COLUMN "ai_model" varchar;
  ALTER TABLE "plans" ADD COLUMN "ai_summary" varchar;
  ALTER TABLE "plans" ADD COLUMN "ai_unlocked" boolean DEFAULT false;
  ALTER TABLE "listing_payments" ADD COLUMN "purpose" "enum_listing_payments_purpose" DEFAULT 'listing' NOT NULL;
  ALTER TABLE "listing_payments" ADD COLUMN "plan_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ai_runs_id" uuid;
  ALTER TABLE "community_settings" ADD COLUMN "planner_ai_enabled" boolean DEFAULT false;
  ALTER TABLE "community_settings" ADD COLUMN "planner_model" "enum_community_settings_planner_model" DEFAULT 'claude-sonnet-5-5';
  ALTER TABLE "community_settings" ADD COLUMN "planner_daily_budget_usd" numeric DEFAULT 5;
  ALTER TABLE "community_settings" ADD COLUMN "planner_free_plans" numeric DEFAULT 1;
  ALTER TABLE "community_settings" ADD COLUMN "planner_price_aud" numeric DEFAULT 4.99;
  ALTER TABLE "_community_settings_v" ADD COLUMN "version_planner_ai_enabled" boolean DEFAULT false;
  ALTER TABLE "_community_settings_v" ADD COLUMN "version_planner_model" "enum__community_settings_v_version_planner_model" DEFAULT 'claude-sonnet-5-5';
  ALTER TABLE "_community_settings_v" ADD COLUMN "version_planner_daily_budget_usd" numeric DEFAULT 5;
  ALTER TABLE "_community_settings_v" ADD COLUMN "version_planner_free_plans" numeric DEFAULT 1;
  ALTER TABLE "_community_settings_v" ADD COLUMN "version_planner_price_aud" numeric DEFAULT 4.99;
  ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_payment_id_listing_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."listing_payments"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "ai_runs_member_idx" ON "ai_runs" USING btree ("member_id");
  CREATE INDEX "ai_runs_plan_idx" ON "ai_runs" USING btree ("plan_id");
  CREATE INDEX "ai_runs_payment_idx" ON "ai_runs" USING btree ("payment_id");
  CREATE INDEX "ai_runs_cost_micro_usd_idx" ON "ai_runs" USING btree ("cost_micro_usd");
  CREATE INDEX "ai_runs_updated_at_idx" ON "ai_runs" USING btree ("updated_at");
  CREATE INDEX "ai_runs_created_at_idx" ON "ai_runs" USING btree ("created_at");
  CREATE INDEX "member_status_idx" ON "ai_runs" USING btree ("member_id","status");
  ALTER TABLE "listing_payments" ADD CONSTRAINT "listing_payments_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ai_runs_fk" FOREIGN KEY ("ai_runs_id") REFERENCES "public"."ai_runs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "listing_payments_plan_idx" ON "listing_payments" USING btree ("plan_id");
  CREATE INDEX "payload_locked_documents_rels_ai_runs_id_idx" ON "payload_locked_documents_rels" USING btree ("ai_runs_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "ai_runs" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "ai_runs" CASCADE;
  ALTER TABLE "listing_payments" DROP CONSTRAINT "listing_payments_plan_id_plans_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ai_runs_fk";
  
  DROP INDEX "listing_payments_plan_idx";
  DROP INDEX "payload_locked_documents_rels_ai_runs_id_idx";
  ALTER TABLE "plans_days_stops" DROP COLUMN "origin";
  ALTER TABLE "plans_days_stops" DROP COLUMN "source_path";
  ALTER TABLE "plans" DROP COLUMN "ai_generated_at";
  ALTER TABLE "plans" DROP COLUMN "ai_model";
  ALTER TABLE "plans" DROP COLUMN "ai_summary";
  ALTER TABLE "plans" DROP COLUMN "ai_unlocked";
  ALTER TABLE "listing_payments" DROP COLUMN "purpose";
  ALTER TABLE "listing_payments" DROP COLUMN "plan_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ai_runs_id";
  ALTER TABLE "community_settings" DROP COLUMN "planner_ai_enabled";
  ALTER TABLE "community_settings" DROP COLUMN "planner_model";
  ALTER TABLE "community_settings" DROP COLUMN "planner_daily_budget_usd";
  ALTER TABLE "community_settings" DROP COLUMN "planner_free_plans";
  ALTER TABLE "community_settings" DROP COLUMN "planner_price_aud";
  ALTER TABLE "_community_settings_v" DROP COLUMN "version_planner_ai_enabled";
  ALTER TABLE "_community_settings_v" DROP COLUMN "version_planner_model";
  ALTER TABLE "_community_settings_v" DROP COLUMN "version_planner_daily_budget_usd";
  ALTER TABLE "_community_settings_v" DROP COLUMN "version_planner_free_plans";
  ALTER TABLE "_community_settings_v" DROP COLUMN "version_planner_price_aud";
  DROP TYPE "public"."enum_plans_days_stops_origin";
  DROP TYPE "public"."enum_listing_payments_purpose";
  DROP TYPE "public"."enum_ai_runs_status";
  DROP TYPE "public"."enum_community_settings_planner_model";
  DROP TYPE "public"."enum__community_settings_v_version_planner_model";`)
}
