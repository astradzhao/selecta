CREATE TYPE "public"."note_status" AS ENUM('draft', 'preview', 'committed');--> statement-breakpoint
CREATE TABLE "notes" (
	"id" text PRIMARY KEY NOT NULL,
	"raw_text" text NOT NULL,
	"extraction" jsonb,
	"status" "note_status" DEFAULT 'draft' NOT NULL,
	"model" text,
	"prompt_version" text,
	"raw_response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
