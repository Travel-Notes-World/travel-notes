import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_members_status" AS ENUM('active', 'suspended', 'deleted');
  CREATE TYPE "public"."enum_contributions_trip_costs_category" AS ENUM('flights', 'accommodation', 'transport', 'food', 'activities', 'shopping', 'insurance', 'visas', 'other');
  CREATE TYPE "public"."enum_contributions_trip_costs_basis" AS ENUM('total', 'per_day', 'per_night');
  CREATE TYPE "public"."enum_contributions_trip_costs_kind" AS ENUM('measured', 'estimate');
  CREATE TYPE "public"."enum_contributions_type" AS ENUM('question', 'trip', 'activity');
  CREATE TYPE "public"."enum_contributions_style" AS ENUM('budget', 'mid_range', 'luxury', 'backpacking', 'family', 'adventure', 'slow', 'road_trip', 'city_break', 'food', 'business');
  CREATE TYPE "public"."enum_contributions_state" AS ENUM('draft', 'pending', 'changes_requested', 'published', 'rejected', 'hidden', 'removed');
  CREATE TYPE "public"."enum_contributions_indexing" AS ENUM('policy', 'allow', 'block');
  CREATE TYPE "public"."enum_contributions_question_party_type" AS ENUM('solo', 'couple', 'family', 'friends', 'group');
  CREATE TYPE "public"."enum_contributions_trip_party_type" AS ENUM('solo', 'couple', 'family', 'friends', 'group');
  CREATE TYPE "public"."enum_contributions_trip_cost_scope" AS ENUM('per_person', 'per_party');
  CREATE TYPE "public"."enum_contributions_activity_category" AS ENUM('community_gathering', 'public_event', 'commercial_activity');
  CREATE TYPE "public"."enum_contributions_activity_format" AS ENUM('in_person', 'online');
  CREATE TYPE "public"."enum_contributions_activity_event_status" AS ENUM('scheduled', 'postponed', 'rescheduled', 'cancelled', 'ended');
  CREATE TYPE "public"."enum_contributions_activity_price_state" AS ENUM('free', 'paid', 'unknown');
  CREATE TYPE "public"."enum_contributions_activity_disclosure" AS ENUM('none', 'business', 'affiliate', 'sponsored');
  CREATE TYPE "public"."enum_replies_state" AS ENUM('pending', 'published', 'rejected', 'hidden', 'removed');
  CREATE TYPE "public"."enum_revisions_kind" AS ENUM('submission', 'edit');
  CREATE TYPE "public"."enum_revisions_review_state" AS ENUM('pending', 'approved', 'changes_requested', 'rejected', 'superseded');
  CREATE TYPE "public"."enum_media_state" AS ENUM('pending', 'approved', 'rejected', 'withheld', 'removed');
  CREATE TYPE "public"."enum_media_purpose" AS ENUM('photo', 'avatar');
  CREATE TYPE "public"."enum_votes_target_type" AS ENUM('contribution', 'reply');
  CREATE TYPE "public"."enum_bookmarks_target_type" AS ENUM('contribution', 'article');
  CREATE TYPE "public"."enum_rsvps_status" AS ENUM('interested', 'going');
  CREATE TYPE "public"."enum_reports_target_type" AS ENUM('contribution', 'reply', 'member', 'media');
  CREATE TYPE "public"."enum_reports_category" AS ENUM('spam', 'misleading_promotion', 'harassment', 'privacy', 'copyright', 'incorrect', 'event_problem', 'other');
  CREATE TYPE "public"."enum_reports_status" AS ENUM('open', 'resolved', 'dismissed');
  CREATE TYPE "public"."enum_moderation_actions_action" AS ENUM('submit', 'withdraw', 'approve', 'request_changes', 'reject', 'hide', 'unhide', 'remove', 'author_remove', 'propose_revision', 'approve_revision', 'reject_revision', 'approve_reply', 'reject_reply', 'hide_reply', 'remove_reply', 'auto_approve_reply', 'accept_answer', 'unaccept_answer', 'override_accepted_answer', 'mark_duplicate', 'set_indexing', 'event_status', 'verify_organiser', 'fact_check', 'approve_media', 'reject_media', 'remove_media', 'resolve_report', 'dismiss_report', 'suspend', 'unsuspend', 'set_trust', 'account_deleted', 'accept_suggestion', 'reject_suggestion');
  CREATE TYPE "public"."enum_moderation_actions_actor_type" AS ENUM('staff', 'member', 'system');
  CREATE TYPE "public"."enum_moderation_actions_target_type" AS ENUM('contribution', 'reply', 'revision', 'member', 'media', 'report', 'suggestion');
  CREATE TYPE "public"."enum_destination_suggestions_status" AS ENUM('pending', 'accepted', 'rejected');
  CREATE TYPE "public"."enum_notifications_type" AS ENUM('reply_published', 'answer_accepted', 'moderation_decision', 'event_changed', 'account_notice');
  CREATE TYPE "public"."enum_email_outbox_template" AS ENUM('verify_email', 'password_reset', 'reply_published', 'answer_accepted', 'moderation_decision', 'event_changed', 'destination_digest');
  CREATE TYPE "public"."enum_email_outbox_status" AS ENUM('pending', 'sent', 'captured', 'suppressed', 'failed');
  ALTER TYPE "public"."enum_destinations_kind" ADD VALUE 'area';
  ALTER TYPE "public"."enum__destinations_v_version_kind" ADD VALUE 'area';
  CREATE TABLE "destinations_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_destinations_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "members_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "members" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"handle" varchar NOT NULL,
  	"display_name" varchar NOT NULL,
  	"bio" varchar,
  	"experience" varchar,
  	"avatar_id" uuid,
  	"status" "enum_members_status" DEFAULT 'active' NOT NULL,
  	"status_reason" varchar,
  	"suspended_until" timestamp(3) with time zone,
  	"trusted" boolean DEFAULT false,
  	"terms_accepted_at" timestamp(3) with time zone,
  	"email_prefs_replies" boolean DEFAULT true,
  	"email_prefs_moderation" boolean DEFAULT true,
  	"email_prefs_events" boolean DEFAULT true,
  	"email_prefs_digest" boolean DEFAULT false,
  	"last_digest_at" timestamp(3) with time zone,
  	"published_count" numeric DEFAULT 0,
  	"answer_count" numeric DEFAULT 0,
  	"deleted_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"_verified" boolean,
  	"_verificationtoken" varchar
  );
  
  CREATE TABLE "contributions_trip_costs" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"category" "enum_contributions_trip_costs_category",
  	"amount_minor" numeric,
  	"currency" varchar,
  	"basis" "enum_contributions_trip_costs_basis" DEFAULT 'total',
  	"quantity" numeric DEFAULT 1,
  	"date" varchar,
  	"kind" "enum_contributions_trip_costs_kind" DEFAULT 'measured',
  	"note" varchar
  );
  
  CREATE TABLE "contributions_itinerary_days_stops" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"destination_id" uuid,
  	"place" varchar,
  	"time_note" varchar,
  	"cost_minor" numeric,
  	"cost_currency" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "contributions_itinerary_days" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"date" varchar
  );
  
  CREATE TABLE "contributions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"short_id" varchar NOT NULL,
  	"type" "enum_contributions_type" NOT NULL,
  	"author_id" uuid NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"body" varchar,
  	"language" varchar DEFAULT 'en' NOT NULL,
  	"style" "enum_contributions_style",
  	"state" "enum_contributions_state" DEFAULT 'draft' NOT NULL,
  	"submitted_at" timestamp(3) with time zone,
  	"published_at" timestamp(3) with time zone,
  	"content_updated_at" timestamp(3) with time zone,
  	"published_revision_id" uuid,
  	"pending_revision_id" uuid,
  	"indexing" "enum_contributions_indexing" DEFAULT 'policy' NOT NULL,
  	"moderation_note" varchar,
  	"moderation_internal_note" varchar,
  	"moderation_reviewed_by_id" uuid,
  	"moderation_reviewed_at" timestamp(3) with time zone,
  	"reply_count" numeric DEFAULT 0,
  	"helpful_count" numeric DEFAULT 0,
  	"search_text" varchar,
  	"question_travel_month" varchar,
  	"question_duration_days" numeric,
  	"question_party_type" "enum_contributions_question_party_type",
  	"question_budget_minor" numeric,
  	"question_budget_currency" varchar,
  	"question_resolved" boolean DEFAULT false,
  	"question_accepted_answer_id" uuid,
  	"question_duplicate_of_id" uuid,
  	"trip_start_date" varchar,
  	"trip_end_date" varchar,
  	"trip_travel_month" varchar,
  	"trip_duration_days" numeric,
  	"trip_nights" numeric,
  	"trip_party_size" numeric,
  	"trip_party_type" "enum_contributions_trip_party_type",
  	"trip_cost_scope" "enum_contributions_trip_cost_scope",
  	"trip_flights_included" boolean,
  	"trip_cost_notes" varchar,
  	"trip_transport" varchar,
  	"trip_recommendations" varchar,
  	"trip_mistakes" varchar,
  	"trip_permission_given_at" timestamp(3) with time zone,
  	"activity_category" "enum_contributions_activity_category",
  	"activity_format" "enum_contributions_activity_format",
  	"activity_venue_name" varchar,
  	"activity_venue_address" varchar,
  	"activity_time_zone" varchar,
  	"activity_all_day" boolean DEFAULT false,
  	"activity_starts_at" timestamp(3) with time zone,
  	"activity_ends_at" timestamp(3) with time zone,
  	"activity_start_local" varchar,
  	"activity_end_local" varchar,
  	"activity_original_start_local" varchar,
  	"activity_event_status" "enum_contributions_activity_event_status" DEFAULT 'scheduled',
  	"activity_status_note" varchar,
  	"activity_status_changed_at" timestamp(3) with time zone,
  	"activity_price_state" "enum_contributions_activity_price_state",
  	"activity_price_minor" numeric,
  	"activity_price_currency" varchar,
  	"activity_booking_url" varchar,
  	"activity_source_url" varchar,
  	"activity_organiser_name" varchar,
  	"activity_organiser_contact" varchar,
  	"activity_organiser_verified" boolean DEFAULT false,
  	"activity_disclosure" "enum_contributions_activity_disclosure" DEFAULT 'none',
  	"activity_audience" varchar,
  	"activity_accessibility" varchar,
  	"activity_capacity" numeric,
  	"activity_last_checked_at" timestamp(3) with time zone,
  	"activity_interested_count" numeric DEFAULT 0,
  	"activity_going_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "contributions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"destinations_id" uuid,
  	"topics_id" uuid,
  	"media_id" uuid
  );
  
  CREATE TABLE "replies" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"contribution_id" uuid NOT NULL,
  	"parent_id" uuid,
  	"author_id" uuid NOT NULL,
  	"body" varchar NOT NULL,
  	"state" "enum_replies_state" DEFAULT 'pending' NOT NULL,
  	"published_at" timestamp(3) with time zone,
  	"moderation_note" varchar,
  	"reviewed_by_id" uuid,
  	"helpful_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "revisions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"contribution_id" uuid NOT NULL,
  	"number" numeric NOT NULL,
  	"kind" "enum_revisions_kind" NOT NULL,
  	"editor_id" uuid NOT NULL,
  	"snapshot" jsonb NOT NULL,
  	"review_state" "enum_revisions_review_state" DEFAULT 'pending' NOT NULL,
  	"reason" varchar,
  	"reviewed_by_id" uuid,
  	"reviewed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"owner_id" uuid NOT NULL,
  	"alt" varchar,
  	"state" "enum_media_state" DEFAULT 'pending' NOT NULL,
  	"rights_confirmed_at" timestamp(3) with time zone NOT NULL,
  	"contribution_id" uuid,
  	"purpose" "enum_media_purpose" DEFAULT 'photo' NOT NULL,
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
  	"sizes_card_filename" varchar
  );
  
  CREATE TABLE "votes" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"member_id" uuid NOT NULL,
  	"target_type" "enum_votes_target_type" NOT NULL,
  	"target_id" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "bookmarks" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"member_id" uuid NOT NULL,
  	"target_type" "enum_bookmarks_target_type" NOT NULL,
  	"target_id" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "follows" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"member_id" uuid NOT NULL,
  	"destination_id" uuid NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rsvps" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"member_id" uuid NOT NULL,
  	"activity_id" uuid NOT NULL,
  	"status" "enum_rsvps_status" NOT NULL,
  	"show_publicly" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "plans_days_stops" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"place" varchar,
  	"notes" varchar,
  	"saved_contribution_id" uuid
  );
  
  CREATE TABLE "plans_days" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"date" varchar
  );
  
  CREATE TABLE "plans" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"owner_id" uuid NOT NULL,
  	"title" varchar NOT NULL,
  	"start_date" varchar,
  	"end_date" varchar,
  	"notes" varchar,
  	"source_contribution_id" uuid,
  	"source_title" varchar,
  	"source_author_name" varchar,
  	"source_copied_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "reports" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"reporter_id" uuid NOT NULL,
  	"target_type" "enum_reports_target_type" NOT NULL,
  	"target_id" varchar NOT NULL,
  	"contribution_id" uuid,
  	"category" "enum_reports_category" NOT NULL,
  	"details" varchar,
  	"status" "enum_reports_status" DEFAULT 'open' NOT NULL,
  	"resolution" varchar,
  	"resolved_by_id" uuid,
  	"resolved_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "moderation_actions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"action" "enum_moderation_actions_action" NOT NULL,
  	"actor_type" "enum_moderation_actions_actor_type" NOT NULL,
  	"staff_id" uuid,
  	"member_id" uuid,
  	"target_type" "enum_moderation_actions_target_type" NOT NULL,
  	"target_id" varchar NOT NULL,
  	"contribution_id" uuid,
  	"reason" varchar,
  	"details" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "destination_suggestions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"member_id" uuid NOT NULL,
  	"name" varchar NOT NULL,
  	"country" varchar NOT NULL,
  	"details" varchar,
  	"status" "enum_destination_suggestions_status" DEFAULT 'pending' NOT NULL,
  	"destination_id" uuid,
  	"resolution" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "notifications" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"dedupe_key" varchar NOT NULL,
  	"recipient_id" uuid NOT NULL,
  	"type" "enum_notifications_type" NOT NULL,
  	"message" varchar NOT NULL,
  	"path" varchar,
  	"read_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "email_outbox" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"idempotency_key" varchar NOT NULL,
  	"template" "enum_email_outbox_template" NOT NULL,
  	"recipient_id" uuid,
  	"data" jsonb,
  	"status" "enum_email_outbox_status" DEFAULT 'pending' NOT NULL,
  	"attempts" numeric DEFAULT 0 NOT NULL,
  	"next_attempt_at" timestamp(3) with time zone,
  	"last_error" varchar,
  	"transport" varchar,
  	"provider_id" varchar,
  	"sent_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rate_limits" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"count" numeric DEFAULT 0 NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "metric_counters" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"event" varchar NOT NULL,
  	"day" varchar NOT NULL,
  	"dimension" varchar,
  	"count" numeric DEFAULT 0 NOT NULL
  );
  
  CREATE TABLE "job_runs" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"job" varchar NOT NULL,
  	"ok" boolean DEFAULT true NOT NULL,
  	"summary" varchar,
  	"duration_ms" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "community_settings" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"public_access" boolean DEFAULT false,
  	"signups_open" boolean DEFAULT false,
  	"submissions_open" boolean DEFAULT true,
  	"max_pending_per_member" numeric DEFAULT 5,
  	"indexing_questions_auto" boolean DEFAULT true,
  	"indexing_question_min_answers" numeric DEFAULT 1,
  	"indexing_profile_min_published" numeric DEFAULT 2,
  	"review_auto_approve_trusted_replies" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_community_settings_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"version_public_access" boolean DEFAULT false,
  	"version_signups_open" boolean DEFAULT false,
  	"version_submissions_open" boolean DEFAULT true,
  	"version_max_pending_per_member" numeric DEFAULT 5,
  	"version_indexing_questions_auto" boolean DEFAULT true,
  	"version_indexing_question_min_answers" numeric DEFAULT 1,
  	"version_indexing_profile_min_published" numeric DEFAULT 2,
  	"version_review_auto_approve_trusted_replies" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "destinations" ADD COLUMN "latitude" numeric;
  ALTER TABLE "destinations" ADD COLUMN "longitude" numeric;
  ALTER TABLE "destinations" ADD COLUMN "time_zone" varchar;
  ALTER TABLE "destinations" ADD COLUMN "population" numeric;
  ALTER TABLE "destinations" ADD COLUMN "hub_indexable" boolean DEFAULT false;
  ALTER TABLE "destinations" ADD COLUMN "source_name" varchar;
  ALTER TABLE "destinations" ADD COLUMN "source_external_id" varchar;
  ALTER TABLE "destinations" ADD COLUMN "source_licence" varchar;
  ALTER TABLE "destinations" ADD COLUMN "source_imported_at" timestamp(3) with time zone;
  ALTER TABLE "_destinations_v" ADD COLUMN "version_latitude" numeric;
  ALTER TABLE "_destinations_v" ADD COLUMN "version_longitude" numeric;
  ALTER TABLE "_destinations_v" ADD COLUMN "version_time_zone" varchar;
  ALTER TABLE "_destinations_v" ADD COLUMN "version_population" numeric;
  ALTER TABLE "_destinations_v" ADD COLUMN "version_hub_indexable" boolean DEFAULT false;
  ALTER TABLE "_destinations_v" ADD COLUMN "version_source_name" varchar;
  ALTER TABLE "_destinations_v" ADD COLUMN "version_source_external_id" varchar;
  ALTER TABLE "_destinations_v" ADD COLUMN "version_source_licence" varchar;
  ALTER TABLE "_destinations_v" ADD COLUMN "version_source_imported_at" timestamp(3) with time zone;
  ALTER TABLE "staff" ADD COLUMN "community_moderator" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "members_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "contributions_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "replies_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "revisions_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "media_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "votes_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "bookmarks_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "follows_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "rsvps_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "plans_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "reports_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "moderation_actions_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "destination_suggestions_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "notifications_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "email_outbox_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "rate_limits_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "metric_counters_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "job_runs_id" uuid;
  ALTER TABLE "payload_preferences_rels" ADD COLUMN "members_id" uuid;
  ALTER TABLE "destinations_texts" ADD CONSTRAINT "destinations_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_destinations_v_texts" ADD CONSTRAINT "_destinations_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_destinations_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "members_sessions" ADD CONSTRAINT "members_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "members" ADD CONSTRAINT "members_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contributions_trip_costs" ADD CONSTRAINT "contributions_trip_costs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."contributions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "contributions_itinerary_days_stops" ADD CONSTRAINT "contributions_itinerary_days_stops_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contributions_itinerary_days_stops" ADD CONSTRAINT "contributions_itinerary_days_stops_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."contributions_itinerary_days"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "contributions_itinerary_days" ADD CONSTRAINT "contributions_itinerary_days_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."contributions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "contributions" ADD CONSTRAINT "contributions_author_id_members_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contributions" ADD CONSTRAINT "contributions_published_revision_id_revisions_id_fk" FOREIGN KEY ("published_revision_id") REFERENCES "public"."revisions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contributions" ADD CONSTRAINT "contributions_pending_revision_id_revisions_id_fk" FOREIGN KEY ("pending_revision_id") REFERENCES "public"."revisions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contributions" ADD CONSTRAINT "contributions_moderation_reviewed_by_id_staff_id_fk" FOREIGN KEY ("moderation_reviewed_by_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contributions" ADD CONSTRAINT "contributions_question_accepted_answer_id_replies_id_fk" FOREIGN KEY ("question_accepted_answer_id") REFERENCES "public"."replies"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contributions" ADD CONSTRAINT "contributions_question_duplicate_of_id_contributions_id_fk" FOREIGN KEY ("question_duplicate_of_id") REFERENCES "public"."contributions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contributions_rels" ADD CONSTRAINT "contributions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."contributions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "contributions_rels" ADD CONSTRAINT "contributions_rels_destinations_fk" FOREIGN KEY ("destinations_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "contributions_rels" ADD CONSTRAINT "contributions_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "contributions_rels" ADD CONSTRAINT "contributions_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "replies" ADD CONSTRAINT "replies_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "replies" ADD CONSTRAINT "replies_parent_id_replies_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."replies"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "replies" ADD CONSTRAINT "replies_author_id_members_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "replies" ADD CONSTRAINT "replies_reviewed_by_id_staff_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "revisions" ADD CONSTRAINT "revisions_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "revisions" ADD CONSTRAINT "revisions_editor_id_members_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "revisions" ADD CONSTRAINT "revisions_reviewed_by_id_staff_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "media" ADD CONSTRAINT "media_owner_id_members_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "media" ADD CONSTRAINT "media_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "votes" ADD CONSTRAINT "votes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "follows" ADD CONSTRAINT "follows_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "follows" ADD CONSTRAINT "follows_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_activity_id_contributions_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."contributions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "plans_days_stops" ADD CONSTRAINT "plans_days_stops_saved_contribution_id_contributions_id_fk" FOREIGN KEY ("saved_contribution_id") REFERENCES "public"."contributions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "plans_days_stops" ADD CONSTRAINT "plans_days_stops_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."plans_days"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "plans_days" ADD CONSTRAINT "plans_days_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "plans" ADD CONSTRAINT "plans_owner_id_members_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "plans" ADD CONSTRAINT "plans_source_contribution_id_contributions_id_fk" FOREIGN KEY ("source_contribution_id") REFERENCES "public"."contributions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_members_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reports" ADD CONSTRAINT "reports_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_id_staff_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "destination_suggestions" ADD CONSTRAINT "destination_suggestions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "destination_suggestions" ADD CONSTRAINT "destination_suggestions_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_members_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_recipient_id_members_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "destinations_texts_order_parent" ON "destinations_texts" USING btree ("order","parent_id");
  CREATE INDEX "_destinations_v_texts_order_parent" ON "_destinations_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "members_sessions_order_idx" ON "members_sessions" USING btree ("_order");
  CREATE INDEX "members_sessions_parent_id_idx" ON "members_sessions" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "members_handle_idx" ON "members" USING btree ("handle");
  CREATE INDEX "members_avatar_idx" ON "members" USING btree ("avatar_id");
  CREATE INDEX "members_status_idx" ON "members" USING btree ("status");
  CREATE INDEX "members_updated_at_idx" ON "members" USING btree ("updated_at");
  CREATE INDEX "members_created_at_idx" ON "members" USING btree ("created_at");
  CREATE UNIQUE INDEX "members_email_idx" ON "members" USING btree ("email");
  CREATE INDEX "contributions_trip_costs_order_idx" ON "contributions_trip_costs" USING btree ("_order");
  CREATE INDEX "contributions_trip_costs_parent_id_idx" ON "contributions_trip_costs" USING btree ("_parent_id");
  CREATE INDEX "contributions_itinerary_days_stops_order_idx" ON "contributions_itinerary_days_stops" USING btree ("_order");
  CREATE INDEX "contributions_itinerary_days_stops_parent_id_idx" ON "contributions_itinerary_days_stops" USING btree ("_parent_id");
  CREATE INDEX "contributions_itinerary_days_stops_destination_idx" ON "contributions_itinerary_days_stops" USING btree ("destination_id");
  CREATE INDEX "contributions_itinerary_days_order_idx" ON "contributions_itinerary_days" USING btree ("_order");
  CREATE INDEX "contributions_itinerary_days_parent_id_idx" ON "contributions_itinerary_days" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "contributions_short_id_idx" ON "contributions" USING btree ("short_id");
  CREATE INDEX "contributions_author_idx" ON "contributions" USING btree ("author_id");
  CREATE INDEX "contributions_state_idx" ON "contributions" USING btree ("state");
  CREATE INDEX "contributions_published_at_idx" ON "contributions" USING btree ("published_at");
  CREATE INDEX "contributions_published_revision_idx" ON "contributions" USING btree ("published_revision_id");
  CREATE INDEX "contributions_pending_revision_idx" ON "contributions" USING btree ("pending_revision_id");
  CREATE INDEX "contributions_moderation_moderation_reviewed_by_idx" ON "contributions" USING btree ("moderation_reviewed_by_id");
  CREATE INDEX "contributions_question_question_accepted_answer_idx" ON "contributions" USING btree ("question_accepted_answer_id");
  CREATE INDEX "contributions_question_question_duplicate_of_idx" ON "contributions" USING btree ("question_duplicate_of_id");
  CREATE INDEX "contributions_updated_at_idx" ON "contributions" USING btree ("updated_at");
  CREATE INDEX "contributions_created_at_idx" ON "contributions" USING btree ("created_at");
  CREATE INDEX "type_state_publishedAt_idx" ON "contributions" USING btree ("type","state","published_at");
  CREATE INDEX "state_submittedAt_idx" ON "contributions" USING btree ("state","submitted_at");
  CREATE INDEX "author_state_idx" ON "contributions" USING btree ("author_id","state");
  CREATE INDEX "activity_eventStatus_activity_startsAt_idx" ON "contributions" USING btree ("activity_event_status","activity_starts_at");
  CREATE INDEX "activity_endsAt_idx" ON "contributions" USING btree ("activity_ends_at");
  CREATE INDEX "contributions_rels_order_idx" ON "contributions_rels" USING btree ("order");
  CREATE INDEX "contributions_rels_parent_idx" ON "contributions_rels" USING btree ("parent_id");
  CREATE INDEX "contributions_rels_path_idx" ON "contributions_rels" USING btree ("path");
  CREATE INDEX "contributions_rels_destinations_id_idx" ON "contributions_rels" USING btree ("destinations_id");
  CREATE INDEX "contributions_rels_topics_id_idx" ON "contributions_rels" USING btree ("topics_id");
  CREATE INDEX "contributions_rels_media_id_idx" ON "contributions_rels" USING btree ("media_id");
  CREATE INDEX "replies_contribution_idx" ON "replies" USING btree ("contribution_id");
  CREATE INDEX "replies_parent_idx" ON "replies" USING btree ("parent_id");
  CREATE INDEX "replies_author_idx" ON "replies" USING btree ("author_id");
  CREATE INDEX "replies_state_idx" ON "replies" USING btree ("state");
  CREATE INDEX "replies_reviewed_by_idx" ON "replies" USING btree ("reviewed_by_id");
  CREATE INDEX "replies_updated_at_idx" ON "replies" USING btree ("updated_at");
  CREATE INDEX "replies_created_at_idx" ON "replies" USING btree ("created_at");
  CREATE INDEX "contribution_state_createdAt_idx" ON "replies" USING btree ("contribution_id","state","created_at");
  CREATE INDEX "state_createdAt_idx" ON "replies" USING btree ("state","created_at");
  CREATE INDEX "author_state_1_idx" ON "replies" USING btree ("author_id","state");
  CREATE INDEX "revisions_contribution_idx" ON "revisions" USING btree ("contribution_id");
  CREATE INDEX "revisions_editor_idx" ON "revisions" USING btree ("editor_id");
  CREATE INDEX "revisions_reviewed_by_idx" ON "revisions" USING btree ("reviewed_by_id");
  CREATE INDEX "revisions_updated_at_idx" ON "revisions" USING btree ("updated_at");
  CREATE INDEX "revisions_created_at_idx" ON "revisions" USING btree ("created_at");
  CREATE UNIQUE INDEX "contribution_number_idx" ON "revisions" USING btree ("contribution_id","number");
  CREATE INDEX "reviewState_createdAt_idx" ON "revisions" USING btree ("review_state","created_at");
  CREATE INDEX "media_owner_idx" ON "media" USING btree ("owner_id");
  CREATE INDEX "media_state_idx" ON "media" USING btree ("state");
  CREATE INDEX "media_contribution_idx" ON "media" USING btree ("contribution_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumb_sizes_thumb_filename_idx" ON "media" USING btree ("sizes_thumb_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE INDEX "state_createdAt_1_idx" ON "media" USING btree ("state","created_at");
  CREATE INDEX "owner_state_idx" ON "media" USING btree ("owner_id","state");
  CREATE UNIQUE INDEX "votes_key_idx" ON "votes" USING btree ("key");
  CREATE INDEX "votes_member_idx" ON "votes" USING btree ("member_id");
  CREATE INDEX "votes_updated_at_idx" ON "votes" USING btree ("updated_at");
  CREATE INDEX "votes_created_at_idx" ON "votes" USING btree ("created_at");
  CREATE INDEX "targetType_targetId_idx" ON "votes" USING btree ("target_type","target_id");
  CREATE UNIQUE INDEX "bookmarks_key_idx" ON "bookmarks" USING btree ("key");
  CREATE INDEX "bookmarks_member_idx" ON "bookmarks" USING btree ("member_id");
  CREATE INDEX "bookmarks_updated_at_idx" ON "bookmarks" USING btree ("updated_at");
  CREATE INDEX "bookmarks_created_at_idx" ON "bookmarks" USING btree ("created_at");
  CREATE UNIQUE INDEX "follows_key_idx" ON "follows" USING btree ("key");
  CREATE INDEX "follows_member_idx" ON "follows" USING btree ("member_id");
  CREATE INDEX "follows_destination_idx" ON "follows" USING btree ("destination_id");
  CREATE INDEX "follows_updated_at_idx" ON "follows" USING btree ("updated_at");
  CREATE INDEX "follows_created_at_idx" ON "follows" USING btree ("created_at");
  CREATE UNIQUE INDEX "rsvps_key_idx" ON "rsvps" USING btree ("key");
  CREATE INDEX "rsvps_member_idx" ON "rsvps" USING btree ("member_id");
  CREATE INDEX "rsvps_activity_idx" ON "rsvps" USING btree ("activity_id");
  CREATE INDEX "rsvps_updated_at_idx" ON "rsvps" USING btree ("updated_at");
  CREATE INDEX "rsvps_created_at_idx" ON "rsvps" USING btree ("created_at");
  CREATE INDEX "plans_days_stops_order_idx" ON "plans_days_stops" USING btree ("_order");
  CREATE INDEX "plans_days_stops_parent_id_idx" ON "plans_days_stops" USING btree ("_parent_id");
  CREATE INDEX "plans_days_stops_saved_contribution_idx" ON "plans_days_stops" USING btree ("saved_contribution_id");
  CREATE INDEX "plans_days_order_idx" ON "plans_days" USING btree ("_order");
  CREATE INDEX "plans_days_parent_id_idx" ON "plans_days" USING btree ("_parent_id");
  CREATE INDEX "plans_owner_idx" ON "plans" USING btree ("owner_id");
  CREATE INDEX "plans_source_source_contribution_idx" ON "plans" USING btree ("source_contribution_id");
  CREATE INDEX "plans_updated_at_idx" ON "plans" USING btree ("updated_at");
  CREATE INDEX "plans_created_at_idx" ON "plans" USING btree ("created_at");
  CREATE UNIQUE INDEX "reports_key_idx" ON "reports" USING btree ("key");
  CREATE INDEX "reports_reporter_idx" ON "reports" USING btree ("reporter_id");
  CREATE INDEX "reports_contribution_idx" ON "reports" USING btree ("contribution_id");
  CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status");
  CREATE INDEX "reports_resolved_by_idx" ON "reports" USING btree ("resolved_by_id");
  CREATE INDEX "reports_updated_at_idx" ON "reports" USING btree ("updated_at");
  CREATE INDEX "reports_created_at_idx" ON "reports" USING btree ("created_at");
  CREATE INDEX "status_createdAt_idx" ON "reports" USING btree ("status","created_at");
  CREATE INDEX "targetType_targetId_1_idx" ON "reports" USING btree ("target_type","target_id");
  CREATE INDEX "moderation_actions_action_idx" ON "moderation_actions" USING btree ("action");
  CREATE INDEX "moderation_actions_staff_idx" ON "moderation_actions" USING btree ("staff_id");
  CREATE INDEX "moderation_actions_member_idx" ON "moderation_actions" USING btree ("member_id");
  CREATE INDEX "moderation_actions_contribution_idx" ON "moderation_actions" USING btree ("contribution_id");
  CREATE INDEX "moderation_actions_updated_at_idx" ON "moderation_actions" USING btree ("updated_at");
  CREATE INDEX "moderation_actions_created_at_idx" ON "moderation_actions" USING btree ("created_at");
  CREATE INDEX "targetType_targetId_createdAt_idx" ON "moderation_actions" USING btree ("target_type","target_id","created_at");
  CREATE INDEX "destination_suggestions_member_idx" ON "destination_suggestions" USING btree ("member_id");
  CREATE INDEX "destination_suggestions_destination_idx" ON "destination_suggestions" USING btree ("destination_id");
  CREATE INDEX "destination_suggestions_updated_at_idx" ON "destination_suggestions" USING btree ("updated_at");
  CREATE INDEX "destination_suggestions_created_at_idx" ON "destination_suggestions" USING btree ("created_at");
  CREATE INDEX "status_createdAt_1_idx" ON "destination_suggestions" USING btree ("status","created_at");
  CREATE UNIQUE INDEX "notifications_dedupe_key_idx" ON "notifications" USING btree ("dedupe_key");
  CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient_id");
  CREATE INDEX "notifications_updated_at_idx" ON "notifications" USING btree ("updated_at");
  CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");
  CREATE INDEX "recipient_readAt_createdAt_idx" ON "notifications" USING btree ("recipient_id","read_at","created_at");
  CREATE UNIQUE INDEX "email_outbox_idempotency_key_idx" ON "email_outbox" USING btree ("idempotency_key");
  CREATE INDEX "email_outbox_recipient_idx" ON "email_outbox" USING btree ("recipient_id");
  CREATE INDEX "email_outbox_status_idx" ON "email_outbox" USING btree ("status");
  CREATE INDEX "email_outbox_updated_at_idx" ON "email_outbox" USING btree ("updated_at");
  CREATE INDEX "email_outbox_created_at_idx" ON "email_outbox" USING btree ("created_at");
  CREATE INDEX "status_nextAttemptAt_idx" ON "email_outbox" USING btree ("status","next_attempt_at");
  CREATE UNIQUE INDEX "rate_limits_key_idx" ON "rate_limits" USING btree ("key");
  CREATE INDEX "rate_limits_expires_at_idx" ON "rate_limits" USING btree ("expires_at");
  CREATE UNIQUE INDEX "metric_counters_key_idx" ON "metric_counters" USING btree ("key");
  CREATE INDEX "event_day_idx" ON "metric_counters" USING btree ("event","day");
  CREATE INDEX "job_runs_updated_at_idx" ON "job_runs" USING btree ("updated_at");
  CREATE INDEX "job_runs_created_at_idx" ON "job_runs" USING btree ("created_at");
  CREATE INDEX "job_createdAt_idx" ON "job_runs" USING btree ("job","created_at");
  CREATE INDEX "_community_settings_v_created_at_idx" ON "_community_settings_v" USING btree ("created_at");
  CREATE INDEX "_community_settings_v_updated_at_idx" ON "_community_settings_v" USING btree ("updated_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_members_fk" FOREIGN KEY ("members_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_contributions_fk" FOREIGN KEY ("contributions_id") REFERENCES "public"."contributions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_replies_fk" FOREIGN KEY ("replies_id") REFERENCES "public"."replies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_revisions_fk" FOREIGN KEY ("revisions_id") REFERENCES "public"."revisions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_votes_fk" FOREIGN KEY ("votes_id") REFERENCES "public"."votes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bookmarks_fk" FOREIGN KEY ("bookmarks_id") REFERENCES "public"."bookmarks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_follows_fk" FOREIGN KEY ("follows_id") REFERENCES "public"."follows"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rsvps_fk" FOREIGN KEY ("rsvps_id") REFERENCES "public"."rsvps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reports_fk" FOREIGN KEY ("reports_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_moderation_actions_fk" FOREIGN KEY ("moderation_actions_id") REFERENCES "public"."moderation_actions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_destination_suggestions_fk" FOREIGN KEY ("destination_suggestions_id") REFERENCES "public"."destination_suggestions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notifications_fk" FOREIGN KEY ("notifications_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_email_outbox_fk" FOREIGN KEY ("email_outbox_id") REFERENCES "public"."email_outbox"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rate_limits_fk" FOREIGN KEY ("rate_limits_id") REFERENCES "public"."rate_limits"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_metric_counters_fk" FOREIGN KEY ("metric_counters_id") REFERENCES "public"."metric_counters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_job_runs_fk" FOREIGN KEY ("job_runs_id") REFERENCES "public"."job_runs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_members_fk" FOREIGN KEY ("members_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "destinations_source_source_external_id_idx" ON "destinations" USING btree ("source_external_id");
  CREATE INDEX "_destinations_v_version_source_version_source_external_i_idx" ON "_destinations_v" USING btree ("version_source_external_id");
  CREATE INDEX "payload_locked_documents_rels_members_id_idx" ON "payload_locked_documents_rels" USING btree ("members_id");
  CREATE INDEX "payload_locked_documents_rels_contributions_id_idx" ON "payload_locked_documents_rels" USING btree ("contributions_id");
  CREATE INDEX "payload_locked_documents_rels_replies_id_idx" ON "payload_locked_documents_rels" USING btree ("replies_id");
  CREATE INDEX "payload_locked_documents_rels_revisions_id_idx" ON "payload_locked_documents_rels" USING btree ("revisions_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_votes_id_idx" ON "payload_locked_documents_rels" USING btree ("votes_id");
  CREATE INDEX "payload_locked_documents_rels_bookmarks_id_idx" ON "payload_locked_documents_rels" USING btree ("bookmarks_id");
  CREATE INDEX "payload_locked_documents_rels_follows_id_idx" ON "payload_locked_documents_rels" USING btree ("follows_id");
  CREATE INDEX "payload_locked_documents_rels_rsvps_id_idx" ON "payload_locked_documents_rels" USING btree ("rsvps_id");
  CREATE INDEX "payload_locked_documents_rels_plans_id_idx" ON "payload_locked_documents_rels" USING btree ("plans_id");
  CREATE INDEX "payload_locked_documents_rels_reports_id_idx" ON "payload_locked_documents_rels" USING btree ("reports_id");
  CREATE INDEX "payload_locked_documents_rels_moderation_actions_id_idx" ON "payload_locked_documents_rels" USING btree ("moderation_actions_id");
  CREATE INDEX "payload_locked_documents_rels_destination_suggestions_id_idx" ON "payload_locked_documents_rels" USING btree ("destination_suggestions_id");
  CREATE INDEX "payload_locked_documents_rels_notifications_id_idx" ON "payload_locked_documents_rels" USING btree ("notifications_id");
  CREATE INDEX "payload_locked_documents_rels_email_outbox_id_idx" ON "payload_locked_documents_rels" USING btree ("email_outbox_id");
  CREATE INDEX "payload_locked_documents_rels_rate_limits_id_idx" ON "payload_locked_documents_rels" USING btree ("rate_limits_id");
  CREATE INDEX "payload_locked_documents_rels_metric_counters_id_idx" ON "payload_locked_documents_rels" USING btree ("metric_counters_id");
  CREATE INDEX "payload_locked_documents_rels_job_runs_id_idx" ON "payload_locked_documents_rels" USING btree ("job_runs_id");
  CREATE INDEX "payload_preferences_rels_members_id_idx" ON "payload_preferences_rels" USING btree ("members_id");`)

  // --- Added by hand (not part of the CMS schema, so a later generated migration will not touch it) ---
  // Full-text search over APPROVED content only: "search_text" is filled when a moderator approves and
  // emptied when a post is removed. The column is generated by the database, so it can never be out of step.
  await db.execute(sql`
  ALTER TABLE "contributions" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') || setweight(to_tsvector('english', coalesce("search_text", '')), 'B')
  ) STORED;
  CREATE INDEX "contributions_search_vector_idx" ON "contributions" USING GIN ("search_vector");
  CREATE INDEX "destinations_name_lower_idx" ON "destinations" (lower("name") text_pattern_ops);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "destinations_name_lower_idx";
   ALTER TABLE "destinations_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_destinations_v_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "members_sessions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "members" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "contributions_trip_costs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "contributions_itinerary_days_stops" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "contributions_itinerary_days" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "contributions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "contributions_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "replies" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "revisions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "media" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "votes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "bookmarks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "follows" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "rsvps" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "plans_days_stops" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "plans_days" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "plans" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reports" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "moderation_actions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "destination_suggestions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "notifications" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "email_outbox" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "rate_limits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "metric_counters" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "job_runs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "community_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_community_settings_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "destinations_texts" CASCADE;
  DROP TABLE "_destinations_v_texts" CASCADE;
  DROP TABLE "members_sessions" CASCADE;
  DROP TABLE "members" CASCADE;
  DROP TABLE "contributions_trip_costs" CASCADE;
  DROP TABLE "contributions_itinerary_days_stops" CASCADE;
  DROP TABLE "contributions_itinerary_days" CASCADE;
  DROP TABLE "contributions" CASCADE;
  DROP TABLE "contributions_rels" CASCADE;
  DROP TABLE "replies" CASCADE;
  DROP TABLE "revisions" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "votes" CASCADE;
  DROP TABLE "bookmarks" CASCADE;
  DROP TABLE "follows" CASCADE;
  DROP TABLE "rsvps" CASCADE;
  DROP TABLE "plans_days_stops" CASCADE;
  DROP TABLE "plans_days" CASCADE;
  DROP TABLE "plans" CASCADE;
  DROP TABLE "reports" CASCADE;
  DROP TABLE "moderation_actions" CASCADE;
  DROP TABLE "destination_suggestions" CASCADE;
  DROP TABLE "notifications" CASCADE;
  DROP TABLE "email_outbox" CASCADE;
  DROP TABLE "rate_limits" CASCADE;
  DROP TABLE "metric_counters" CASCADE;
  DROP TABLE "job_runs" CASCADE;
  DROP TABLE "community_settings" CASCADE;
  DROP TABLE "_community_settings_v" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_members_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_contributions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_replies_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_revisions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_media_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_votes_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_bookmarks_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_follows_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_rsvps_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_plans_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_reports_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_moderation_actions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_destination_suggestions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_notifications_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_email_outbox_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_rate_limits_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_metric_counters_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_job_runs_fk";
  
  ALTER TABLE "payload_preferences_rels" DROP CONSTRAINT IF EXISTS "payload_preferences_rels_members_fk";
  
  ALTER TABLE "destinations" ALTER COLUMN "kind" SET DATA TYPE text;
  DROP TYPE "public"."enum_destinations_kind";
  CREATE TYPE "public"."enum_destinations_kind" AS ENUM('country', 'region', 'city');
  ALTER TABLE "destinations" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_destinations_kind" USING "kind"::"public"."enum_destinations_kind";
  ALTER TABLE "_destinations_v" ALTER COLUMN "version_kind" SET DATA TYPE text;
  DROP TYPE "public"."enum__destinations_v_version_kind";
  CREATE TYPE "public"."enum__destinations_v_version_kind" AS ENUM('country', 'region', 'city');
  ALTER TABLE "_destinations_v" ALTER COLUMN "version_kind" SET DATA TYPE "public"."enum__destinations_v_version_kind" USING "version_kind"::"public"."enum__destinations_v_version_kind";
  DROP INDEX IF EXISTS "destinations_source_source_external_id_idx";
  DROP INDEX IF EXISTS "_destinations_v_version_source_version_source_external_i_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_members_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_contributions_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_replies_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_revisions_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_media_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_votes_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_bookmarks_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_follows_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_rsvps_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_plans_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_reports_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_moderation_actions_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_destination_suggestions_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_notifications_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_email_outbox_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_rate_limits_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_metric_counters_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_job_runs_id_idx";
  DROP INDEX IF EXISTS "payload_preferences_rels_members_id_idx";
  ALTER TABLE "destinations" DROP COLUMN "latitude";
  ALTER TABLE "destinations" DROP COLUMN "longitude";
  ALTER TABLE "destinations" DROP COLUMN "time_zone";
  ALTER TABLE "destinations" DROP COLUMN "population";
  ALTER TABLE "destinations" DROP COLUMN "hub_indexable";
  ALTER TABLE "destinations" DROP COLUMN "source_name";
  ALTER TABLE "destinations" DROP COLUMN "source_external_id";
  ALTER TABLE "destinations" DROP COLUMN "source_licence";
  ALTER TABLE "destinations" DROP COLUMN "source_imported_at";
  ALTER TABLE "_destinations_v" DROP COLUMN "version_latitude";
  ALTER TABLE "_destinations_v" DROP COLUMN "version_longitude";
  ALTER TABLE "_destinations_v" DROP COLUMN "version_time_zone";
  ALTER TABLE "_destinations_v" DROP COLUMN "version_population";
  ALTER TABLE "_destinations_v" DROP COLUMN "version_hub_indexable";
  ALTER TABLE "_destinations_v" DROP COLUMN "version_source_name";
  ALTER TABLE "_destinations_v" DROP COLUMN "version_source_external_id";
  ALTER TABLE "_destinations_v" DROP COLUMN "version_source_licence";
  ALTER TABLE "_destinations_v" DROP COLUMN "version_source_imported_at";
  ALTER TABLE "staff" DROP COLUMN "community_moderator";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "members_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "contributions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "replies_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "revisions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "media_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "votes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "bookmarks_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "follows_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "rsvps_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "plans_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "reports_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "moderation_actions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "destination_suggestions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "notifications_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "email_outbox_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "rate_limits_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "metric_counters_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "job_runs_id";
  ALTER TABLE "payload_preferences_rels" DROP COLUMN "members_id";
  DROP TYPE "public"."enum_members_status";
  DROP TYPE "public"."enum_contributions_trip_costs_category";
  DROP TYPE "public"."enum_contributions_trip_costs_basis";
  DROP TYPE "public"."enum_contributions_trip_costs_kind";
  DROP TYPE "public"."enum_contributions_type";
  DROP TYPE "public"."enum_contributions_style";
  DROP TYPE "public"."enum_contributions_state";
  DROP TYPE "public"."enum_contributions_indexing";
  DROP TYPE "public"."enum_contributions_question_party_type";
  DROP TYPE "public"."enum_contributions_trip_party_type";
  DROP TYPE "public"."enum_contributions_trip_cost_scope";
  DROP TYPE "public"."enum_contributions_activity_category";
  DROP TYPE "public"."enum_contributions_activity_format";
  DROP TYPE "public"."enum_contributions_activity_event_status";
  DROP TYPE "public"."enum_contributions_activity_price_state";
  DROP TYPE "public"."enum_contributions_activity_disclosure";
  DROP TYPE "public"."enum_replies_state";
  DROP TYPE "public"."enum_revisions_kind";
  DROP TYPE "public"."enum_revisions_review_state";
  DROP TYPE "public"."enum_media_state";
  DROP TYPE "public"."enum_media_purpose";
  DROP TYPE "public"."enum_votes_target_type";
  DROP TYPE "public"."enum_bookmarks_target_type";
  DROP TYPE "public"."enum_rsvps_status";
  DROP TYPE "public"."enum_reports_target_type";
  DROP TYPE "public"."enum_reports_category";
  DROP TYPE "public"."enum_reports_status";
  DROP TYPE "public"."enum_moderation_actions_action";
  DROP TYPE "public"."enum_moderation_actions_actor_type";
  DROP TYPE "public"."enum_moderation_actions_target_type";
  DROP TYPE "public"."enum_destination_suggestions_status";
  DROP TYPE "public"."enum_notifications_type";
  DROP TYPE "public"."enum_email_outbox_template";
  DROP TYPE "public"."enum_email_outbox_status";`)
}
