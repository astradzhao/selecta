CREATE TYPE "public"."block_kind" AS ENUM('block', 'set');--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "block_kind" DEFAULT 'block' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_track_id" text,
	"end_track_id" text,
	"is_complete" boolean DEFAULT false NOT NULL,
	"library_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "block_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"block_id" text NOT NULL,
	"position" integer NOT NULL,
	"track_id" text NOT NULL,
	"in_transition_id" text,
	"in_block_id" text,
	"is_seam" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "block_steps_single_connector" CHECK (NOT ("block_steps"."in_transition_id" IS NOT NULL AND "block_steps"."in_block_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "block_alternates" (
	"id" text PRIMARY KEY NOT NULL,
	"block_id" text NOT NULL,
	"label" text,
	"from_step_id" text NOT NULL,
	"to_step_id" text NOT NULL,
	"alt_transition_id" text,
	"alt_block_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "block_alternates_single_connector" CHECK (("block_alternates"."alt_transition_id" IS NULL) <> ("block_alternates"."alt_block_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "block_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"block_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "block_version_choices" (
	"version_id" text NOT NULL,
	"alternate_id" text NOT NULL,
	CONSTRAINT "block_version_choices_version_id_alternate_id_pk" PRIMARY KEY("version_id","alternate_id")
);
--> statement-breakpoint
ALTER TABLE "block_steps" ADD CONSTRAINT "block_steps_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_steps" ADD CONSTRAINT "block_steps_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_steps" ADD CONSTRAINT "block_steps_in_transition_id_transitions_id_fk" FOREIGN KEY ("in_transition_id") REFERENCES "public"."transitions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_steps" ADD CONSTRAINT "block_steps_in_block_id_blocks_id_fk" FOREIGN KEY ("in_block_id") REFERENCES "public"."blocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_alternates" ADD CONSTRAINT "block_alternates_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_alternates" ADD CONSTRAINT "block_alternates_from_step_id_block_steps_id_fk" FOREIGN KEY ("from_step_id") REFERENCES "public"."block_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_alternates" ADD CONSTRAINT "block_alternates_to_step_id_block_steps_id_fk" FOREIGN KEY ("to_step_id") REFERENCES "public"."block_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_alternates" ADD CONSTRAINT "block_alternates_alt_transition_id_transitions_id_fk" FOREIGN KEY ("alt_transition_id") REFERENCES "public"."transitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_alternates" ADD CONSTRAINT "block_alternates_alt_block_id_blocks_id_fk" FOREIGN KEY ("alt_block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_versions" ADD CONSTRAINT "block_versions_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_version_choices" ADD CONSTRAINT "block_version_choices_version_id_block_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."block_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_version_choices" ADD CONSTRAINT "block_version_choices_alternate_id_block_alternates_id_fk" FOREIGN KEY ("alternate_id") REFERENCES "public"."block_alternates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_start_track_id_tracks_id_fk" FOREIGN KEY ("start_track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_end_track_id_tracks_id_fk" FOREIGN KEY ("end_track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blocks_endpoints_idx" ON "blocks" USING btree ("start_track_id","end_track_id");--> statement-breakpoint
CREATE INDEX "block_steps_block_position_idx" ON "block_steps" USING btree ("block_id","position");--> statement-breakpoint
CREATE INDEX "block_steps_track_idx" ON "block_steps" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "block_steps_in_transition_idx" ON "block_steps" USING btree ("in_transition_id");--> statement-breakpoint
CREATE INDEX "block_steps_in_block_idx" ON "block_steps" USING btree ("in_block_id");--> statement-breakpoint
CREATE INDEX "block_alternates_block_idx" ON "block_alternates" USING btree ("block_id");--> statement-breakpoint
CREATE INDEX "block_versions_block_idx" ON "block_versions" USING btree ("block_id");--> statement-breakpoint
CREATE INDEX "block_version_choices_alternate_idx" ON "block_version_choices" USING btree ("alternate_id");
