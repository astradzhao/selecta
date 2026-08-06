CREATE TYPE "public"."note_proposal_status" AS ENUM('queued', 'parsing', 'resolving', 'ready', 'needs_review', 'committed', 'failed', 'rejected', 'superseded');--> statement-breakpoint
ALTER TYPE "public"."note_extraction_status" ADD VALUE 'partially_committed' BEFORE 'commit_failed';--> statement-breakpoint
ALTER TABLE "note_agent_runs" ADD COLUMN "workflow_run_id" text;--> statement-breakpoint
CREATE TABLE "note_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"note_id" text NOT NULL,
	"extraction_version" integer NOT NULL,
	"workflow_run_id" text,
	"agent_run_id" text,
	"ordinal" integer DEFAULT 0 NOT NULL,
	"source_start" integer NOT NULL,
	"source_end" integer NOT NULL,
	"source_text" text NOT NULL,
	"source_fingerprint" text NOT NULL,
	"proposal_key" text NOT NULL,
	"status" "note_proposal_status" DEFAULT 'queued' NOT NULL,
	"draft" jsonb,
	"resolution" jsonb,
	"policy_result" jsonb,
	"review_reasons" jsonb,
	"model" text,
	"prompt_version" text,
	"usage" jsonb,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"transition_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "note_proposals" ADD CONSTRAINT "note_proposals_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_proposals" ADD CONSTRAINT "note_proposals_agent_run_id_note_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."note_agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "note_proposals_proposal_key_uidx" ON "note_proposals" USING btree ("proposal_key");--> statement-breakpoint
CREATE UNIQUE INDEX "note_proposals_note_version_fingerprint_uidx" ON "note_proposals" USING btree ("note_id","extraction_version","source_fingerprint");
