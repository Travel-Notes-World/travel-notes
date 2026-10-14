import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_price_checks_method" AS ENUM('editor', 'ai_research');
  CREATE TYPE "public"."enum_exchange_rates_method" AS ENUM('editor', 'ai_research');
  ALTER TYPE "public"."enum_ai_runs_kind" ADD VALUE 'research';
  CREATE TABLE "exchange_rates" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"currency" varchar NOT NULL,
  	"per_aud" numeric NOT NULL,
  	"source_name" varchar NOT NULL,
  	"source_url" varchar NOT NULL,
  	"checked_at" timestamp(3) with time zone NOT NULL,
  	"method" "enum_exchange_rates_method" DEFAULT 'editor',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "price_checks" ADD COLUMN "method" "enum_price_checks_method" DEFAULT 'editor';
  ALTER TABLE "price_checks" ADD COLUMN "quote" varchar;
  ALTER TABLE "ai_runs" ADD COLUMN "place_id" uuid;
  ALTER TABLE "ai_runs" ADD COLUMN "searches" numeric DEFAULT 0;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "exchange_rates_id" uuid;
  CREATE UNIQUE INDEX "exchange_rates_currency_idx" ON "exchange_rates" USING btree ("currency");
  CREATE INDEX "exchange_rates_updated_at_idx" ON "exchange_rates" USING btree ("updated_at");
  CREATE INDEX "exchange_rates_created_at_idx" ON "exchange_rates" USING btree ("created_at");
  ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_place_id_destinations_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_exchange_rates_fk" FOREIGN KEY ("exchange_rates_id") REFERENCES "public"."exchange_rates"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "ai_runs_place_idx" ON "ai_runs" USING btree ("place_id");
  CREATE INDEX "payload_locked_documents_rels_exchange_rates_id_idx" ON "payload_locked_documents_rels" USING btree ("exchange_rates_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "exchange_rates" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "exchange_rates" CASCADE;
  ALTER TABLE "ai_runs" DROP CONSTRAINT "ai_runs_place_id_destinations_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_exchange_rates_fk";
  
  ALTER TABLE "ai_runs" ALTER COLUMN "kind" SET DATA TYPE text;
  ALTER TABLE "ai_runs" ALTER COLUMN "kind" SET DEFAULT 'brief'::text;
  DROP TYPE "public"."enum_ai_runs_kind";
  CREATE TYPE "public"."enum_ai_runs_kind" AS ENUM('brief', 'detailed', 'revision');
  ALTER TABLE "ai_runs" ALTER COLUMN "kind" SET DEFAULT 'brief'::"public"."enum_ai_runs_kind";
  ALTER TABLE "ai_runs" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_ai_runs_kind" USING "kind"::"public"."enum_ai_runs_kind";
  DROP INDEX "ai_runs_place_idx";
  DROP INDEX "payload_locked_documents_rels_exchange_rates_id_idx";
  ALTER TABLE "price_checks" DROP COLUMN "method";
  ALTER TABLE "price_checks" DROP COLUMN "quote";
  ALTER TABLE "ai_runs" DROP COLUMN "place_id";
  ALTER TABLE "ai_runs" DROP COLUMN "searches";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "exchange_rates_id";
  DROP TYPE "public"."enum_price_checks_method";
  DROP TYPE "public"."enum_exchange_rates_method";`)
}
