import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_listing_payments_status" AS ENUM('created', 'paid', 'refunded', 'expired');
  ALTER TYPE "public"."enum_moderation_actions_action" ADD VALUE 'listing_paid';
  ALTER TYPE "public"."enum_moderation_actions_action" ADD VALUE 'refund_listing';
  CREATE TABLE "listing_payments" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"invoice_number" varchar NOT NULL,
  	"contribution_id" uuid,
  	"member_id" uuid,
  	"status" "enum_listing_payments_status" DEFAULT 'created' NOT NULL,
  	"description" varchar NOT NULL,
  	"amount_minor" numeric NOT NULL,
  	"currency" varchar DEFAULT 'AUD' NOT NULL,
  	"gst_minor" numeric DEFAULT 0 NOT NULL,
  	"seller_name" varchar NOT NULL,
  	"seller_abn" varchar NOT NULL,
  	"buyer_email" varchar,
  	"stripe_session_id" varchar,
  	"stripe_payment_intent_id" varchar,
  	"paid_at" timestamp(3) with time zone,
  	"refunded_at" timestamp(3) with time zone,
  	"refund_reason" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "listing_payments_id" uuid;
  ALTER TABLE "community_settings" ADD COLUMN "indexing_activities_auto" boolean DEFAULT true;
  ALTER TABLE "community_settings" ADD COLUMN "listings_enabled" boolean DEFAULT false;
  ALTER TABLE "community_settings" ADD COLUMN "listings_fee_aud" numeric DEFAULT 5;
  ALTER TABLE "community_settings" ADD COLUMN "listings_price_label" varchar DEFAULT 'Launch price';
  ALTER TABLE "community_settings" ADD COLUMN "listings_gst_registered" boolean DEFAULT true;
  ALTER TABLE "community_settings" ADD COLUMN "listings_seller_name" varchar;
  ALTER TABLE "community_settings" ADD COLUMN "listings_seller_abn" varchar;
  ALTER TABLE "_community_settings_v" ADD COLUMN "version_indexing_activities_auto" boolean DEFAULT true;
  ALTER TABLE "_community_settings_v" ADD COLUMN "version_listings_enabled" boolean DEFAULT false;
  ALTER TABLE "_community_settings_v" ADD COLUMN "version_listings_fee_aud" numeric DEFAULT 5;
  ALTER TABLE "_community_settings_v" ADD COLUMN "version_listings_price_label" varchar DEFAULT 'Launch price';
  ALTER TABLE "_community_settings_v" ADD COLUMN "version_listings_gst_registered" boolean DEFAULT true;
  ALTER TABLE "_community_settings_v" ADD COLUMN "version_listings_seller_name" varchar;
  ALTER TABLE "_community_settings_v" ADD COLUMN "version_listings_seller_abn" varchar;
  ALTER TABLE "listing_payments" ADD CONSTRAINT "listing_payments_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "listing_payments" ADD CONSTRAINT "listing_payments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "listing_payments_invoice_number_idx" ON "listing_payments" USING btree ("invoice_number");
  CREATE INDEX "listing_payments_contribution_idx" ON "listing_payments" USING btree ("contribution_id");
  CREATE INDEX "listing_payments_member_idx" ON "listing_payments" USING btree ("member_id");
  CREATE UNIQUE INDEX "listing_payments_stripe_session_id_idx" ON "listing_payments" USING btree ("stripe_session_id");
  CREATE INDEX "listing_payments_updated_at_idx" ON "listing_payments" USING btree ("updated_at");
  CREATE INDEX "listing_payments_created_at_idx" ON "listing_payments" USING btree ("created_at");
  CREATE INDEX "contribution_status_idx" ON "listing_payments" USING btree ("contribution_id","status");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_listing_payments_fk" FOREIGN KEY ("listing_payments_id") REFERENCES "public"."listing_payments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_listing_payments_id_idx" ON "payload_locked_documents_rels" USING btree ("listing_payments_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_listing_payments_fk";
  ALTER TABLE "listing_payments" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "listing_payments" CASCADE;
  
  ALTER TABLE "moderation_actions" ALTER COLUMN "action" SET DATA TYPE text;
  DELETE FROM "moderation_actions" WHERE "action" IN ('listing_paid', 'refund_listing');
  DROP TYPE "public"."enum_moderation_actions_action";
  CREATE TYPE "public"."enum_moderation_actions_action" AS ENUM('submit', 'withdraw', 'approve', 'request_changes', 'reject', 'hide', 'unhide', 'remove', 'author_remove', 'propose_revision', 'approve_revision', 'reject_revision', 'approve_reply', 'reject_reply', 'hide_reply', 'remove_reply', 'auto_approve_reply', 'accept_answer', 'unaccept_answer', 'override_accepted_answer', 'mark_duplicate', 'set_indexing', 'event_status', 'verify_organiser', 'fact_check', 'approve_media', 'reject_media', 'remove_media', 'resolve_report', 'dismiss_report', 'suspend', 'unsuspend', 'set_trust', 'account_deleted', 'send_password_reset', 'resend_verification', 'confirm_email', 'accept_suggestion', 'reject_suggestion');
  ALTER TABLE "moderation_actions" ALTER COLUMN "action" SET DATA TYPE "public"."enum_moderation_actions_action" USING "action"::"public"."enum_moderation_actions_action";
  DROP INDEX "payload_locked_documents_rels_listing_payments_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "listing_payments_id";
  ALTER TABLE "community_settings" DROP COLUMN "indexing_activities_auto";
  ALTER TABLE "community_settings" DROP COLUMN "listings_enabled";
  ALTER TABLE "community_settings" DROP COLUMN "listings_fee_aud";
  ALTER TABLE "community_settings" DROP COLUMN "listings_price_label";
  ALTER TABLE "community_settings" DROP COLUMN "listings_gst_registered";
  ALTER TABLE "community_settings" DROP COLUMN "listings_seller_name";
  ALTER TABLE "community_settings" DROP COLUMN "listings_seller_abn";
  ALTER TABLE "_community_settings_v" DROP COLUMN "version_indexing_activities_auto";
  ALTER TABLE "_community_settings_v" DROP COLUMN "version_listings_enabled";
  ALTER TABLE "_community_settings_v" DROP COLUMN "version_listings_fee_aud";
  ALTER TABLE "_community_settings_v" DROP COLUMN "version_listings_price_label";
  ALTER TABLE "_community_settings_v" DROP COLUMN "version_listings_gst_registered";
  ALTER TABLE "_community_settings_v" DROP COLUMN "version_listings_seller_name";
  ALTER TABLE "_community_settings_v" DROP COLUMN "version_listings_seller_abn";
  DROP TYPE "public"."enum_listing_payments_status";`)
}
