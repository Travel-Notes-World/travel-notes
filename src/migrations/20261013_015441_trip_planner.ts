import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_plans_party" AS ENUM('solo', 'couple', 'family', 'friends');
  CREATE TYPE "public"."enum_plans_pace" AS ENUM('relaxed', 'balanced', 'full');
  CREATE TABLE "plans_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"destinations_id" uuid
  );
  
  ALTER TABLE "plans" ADD COLUMN "party" "enum_plans_party";
  ALTER TABLE "plans" ADD COLUMN "pace" "enum_plans_pace";
  ALTER TABLE "plans_rels" ADD CONSTRAINT "plans_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "plans_rels" ADD CONSTRAINT "plans_rels_destinations_fk" FOREIGN KEY ("destinations_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "plans_rels_order_idx" ON "plans_rels" USING btree ("order");
  CREATE INDEX "plans_rels_parent_idx" ON "plans_rels" USING btree ("parent_id");
  CREATE INDEX "plans_rels_path_idx" ON "plans_rels" USING btree ("path");
  CREATE INDEX "plans_rels_destinations_id_idx" ON "plans_rels" USING btree ("destinations_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "plans_rels" CASCADE;
  ALTER TABLE "plans" DROP COLUMN "party";
  ALTER TABLE "plans" DROP COLUMN "pace";
  DROP TYPE "public"."enum_plans_party";
  DROP TYPE "public"."enum_plans_pace";`)
}
