import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_travel_styles" AS ENUM('budget', 'mid_range', 'luxury', 'backpacking', 'family', 'adventure', 'slow', 'road_trip', 'city_break', 'food', 'business');
  CREATE TYPE "public"."enum__articles_v_version_travel_styles" AS ENUM('budget', 'mid_range', 'luxury', 'backpacking', 'family', 'adventure', 'slow', 'road_trip', 'city_break', 'food', 'business');
  CREATE TABLE "articles_travel_styles" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum_articles_travel_styles",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );
  
  CREATE TABLE "_articles_v_version_travel_styles" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum__articles_v_version_travel_styles",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );
  
  ALTER TABLE "articles_travel_styles" ADD CONSTRAINT "articles_travel_styles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_version_travel_styles" ADD CONSTRAINT "_articles_v_version_travel_styles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_travel_styles_order_idx" ON "articles_travel_styles" USING btree ("order");
  CREATE INDEX "articles_travel_styles_parent_idx" ON "articles_travel_styles" USING btree ("parent_id");
  CREATE INDEX "_articles_v_version_travel_styles_order_idx" ON "_articles_v_version_travel_styles" USING btree ("order");
  CREATE INDEX "_articles_v_version_travel_styles_parent_idx" ON "_articles_v_version_travel_styles" USING btree ("parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "articles_travel_styles" CASCADE;
  DROP TABLE "_articles_v_version_travel_styles" CASCADE;
  DROP TYPE "public"."enum_articles_travel_styles";
  DROP TYPE "public"."enum__articles_v_version_travel_styles";`)
}
