CREATE TYPE "public"."energy_goal" AS ENUM('build', 'cool', 'maintain');--> statement-breakpoint
CREATE TYPE "public"."note_status" AS ENUM('draft', 'preview', 'committed');--> statement-breakpoint
CREATE TABLE "libraries" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_songs" (
	"library_id" text NOT NULL,
	"song_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_songs_library_id_song_id_pk" PRIMARY KEY("library_id","song_id")
);
--> statement-breakpoint
CREATE TABLE "live_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"library_id" text NOT NULL,
	"user_id" text NOT NULL,
	"current_song_id" text,
	"current_bar" integer,
	"energy_goal" "energy_goal",
	"recent_song_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"set_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" text PRIMARY KEY NOT NULL,
	"library_id" text NOT NULL,
	"user_id" text NOT NULL,
	"song_id" text,
	"raw_text" text NOT NULL,
	"extraction" jsonb,
	"status" "note_status" DEFAULT 'draft' NOT NULL,
	"model" text,
	"prompt_version" text,
	"raw_response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "libraries" ADD CONSTRAINT "libraries_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_songs" ADD CONSTRAINT "library_songs_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "libraries_owner_user_id_idx" ON "libraries" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "library_songs_song_id_idx" ON "library_songs" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "live_sessions_library_id_idx" ON "live_sessions" USING btree ("library_id");--> statement-breakpoint
CREATE INDEX "live_sessions_user_id_idx" ON "live_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "live_sessions_current_song_id_idx" ON "live_sessions" USING btree ("current_song_id");--> statement-breakpoint
CREATE INDEX "notes_library_id_idx" ON "notes" USING btree ("library_id");--> statement-breakpoint
CREATE INDEX "notes_user_id_idx" ON "notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notes_song_id_idx" ON "notes" USING btree ("song_id");