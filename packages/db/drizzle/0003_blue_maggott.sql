CREATE TYPE "public"."note_agent_run_status" AS ENUM('running', 'completed', 'failed', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."note_transition_commit_status" AS ENUM('pending', 'committed', 'commit_failed', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."note_extraction_status" ADD VALUE 'needs_review' BEFORE 'failed';--> statement-breakpoint
ALTER TYPE "public"."note_extraction_status" ADD VALUE 'committed' BEFORE 'failed';--> statement-breakpoint
ALTER TYPE "public"."note_extraction_status" ADD VALUE 'commit_failed' BEFORE 'failed';--> statement-breakpoint
CREATE TABLE "note_agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"note_id" text NOT NULL,
	"extraction_version" integer NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"agent_name" text NOT NULL,
	"status" "note_agent_run_status" DEFAULT 'running' NOT NULL,
	"model" text,
	"provider" text,
	"prompt_version" text,
	"prompt_hash" text,
	"step_count" integer DEFAULT 0 NOT NULL,
	"tool_call_count" integer DEFAULT 0 NOT NULL,
	"usage" jsonb,
	"tool_summary" jsonb,
	"plan" jsonb,
	"policy_result" jsonb,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_transition_commits" (
	"id" text PRIMARY KEY NOT NULL,
	"note_id" text NOT NULL,
	"extraction_version" integer NOT NULL,
	"proposal_key" text NOT NULL,
	"status" "note_transition_commit_status" DEFAULT 'pending' NOT NULL,
	"from_track_id" text,
	"to_track_id" text,
	"payload" jsonb,
	"error" text,
	"committed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "note_agent_runs" ADD CONSTRAINT "note_agent_runs_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_transition_commits" ADD CONSTRAINT "note_transition_commits_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "note_agent_runs_note_version_attempt_uidx" ON "note_agent_runs" USING btree ("note_id","extraction_version","attempt");--> statement-breakpoint
CREATE UNIQUE INDEX "note_transition_commits_proposal_key_uidx" ON "note_transition_commits" USING btree ("proposal_key");