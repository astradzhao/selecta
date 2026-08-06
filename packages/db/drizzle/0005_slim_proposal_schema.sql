ALTER TABLE "notes" DROP COLUMN IF EXISTS "status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."note_status";--> statement-breakpoint
ALTER TABLE "note_proposals" DROP COLUMN IF EXISTS "ordinal";--> statement-breakpoint
ALTER TABLE "note_proposals" DROP COLUMN IF EXISTS "workflow_run_id";--> statement-breakpoint
ALTER TABLE "note_proposals" DROP COLUMN IF EXISTS "transition_id";--> statement-breakpoint
ALTER TABLE "note_proposals" DROP COLUMN IF EXISTS "review_reasons";
