ALTER TYPE "public"."note_extraction_status" ADD VALUE IF NOT EXISTS 'dismissed';--> statement-breakpoint
CREATE TYPE "public"."proposal_review_action" AS ENUM('approve', 'reject', 'edit', 'resolve', 'reparse', 'reopen');--> statement-breakpoint
ALTER TABLE "note_proposals" ADD COLUMN "review_state" jsonb;--> statement-breakpoint
ALTER TABLE "note_proposals" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "note_proposals" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "note_proposals" ADD COLUMN "review_note" text;--> statement-breakpoint
CREATE INDEX "note_proposals_status_updated_idx" ON "note_proposals" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "note_proposals_fingerprint_idx" ON "note_proposals" USING btree ("source_fingerprint");--> statement-breakpoint
CREATE TABLE "proposal_review_events" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"action" "proposal_review_action" NOT NULL,
	"actor" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proposal_review_events" ADD CONSTRAINT "proposal_review_events_proposal_id_note_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."note_proposals"("id") ON DELETE cascade ON UPDATE no action;
