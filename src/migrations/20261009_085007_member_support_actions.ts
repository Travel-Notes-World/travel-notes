import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_moderation_actions_action" ADD VALUE 'send_password_reset' BEFORE 'accept_suggestion';
  ALTER TYPE "public"."enum_moderation_actions_action" ADD VALUE 'resend_verification' BEFORE 'accept_suggestion';
  ALTER TYPE "public"."enum_moderation_actions_action" ADD VALUE 'confirm_email' BEFORE 'accept_suggestion';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "moderation_actions" ALTER COLUMN "action" SET DATA TYPE text;
  DROP TYPE "public"."enum_moderation_actions_action";
  CREATE TYPE "public"."enum_moderation_actions_action" AS ENUM('submit', 'withdraw', 'approve', 'request_changes', 'reject', 'hide', 'unhide', 'remove', 'author_remove', 'propose_revision', 'approve_revision', 'reject_revision', 'approve_reply', 'reject_reply', 'hide_reply', 'remove_reply', 'auto_approve_reply', 'accept_answer', 'unaccept_answer', 'override_accepted_answer', 'mark_duplicate', 'set_indexing', 'event_status', 'verify_organiser', 'fact_check', 'approve_media', 'reject_media', 'remove_media', 'resolve_report', 'dismiss_report', 'suspend', 'unsuspend', 'set_trust', 'account_deleted', 'accept_suggestion', 'reject_suggestion');
  ALTER TABLE "moderation_actions" ALTER COLUMN "action" SET DATA TYPE "public"."enum_moderation_actions_action" USING "action"::"public"."enum_moderation_actions_action";`)
}
