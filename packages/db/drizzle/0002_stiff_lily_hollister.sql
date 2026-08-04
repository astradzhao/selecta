CREATE TYPE "public"."note_extraction_status" AS ENUM('idle', 'extracting', 'no_proposal', 'resolving', 'failed');--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "extraction_status" "note_extraction_status" DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "extraction_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "extraction_error" text;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "extraction_confidence" real;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "extraction_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "extraction_finished_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "provider" text;