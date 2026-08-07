CREATE TYPE "public"."folder_kind" AS ENUM('folder', 'playlist');--> statement-breakpoint
CREATE TABLE "artists" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"kind" "folder_kind",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "genres" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subgenres" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_artists" (
	"track_id" text NOT NULL,
	"artist_id" text NOT NULL,
	CONSTRAINT "track_artists_track_id_artist_id_pk" PRIMARY KEY("track_id","artist_id")
);
--> statement-breakpoint
CREATE TABLE "track_external_ids" (
	"track_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_id" text NOT NULL,
	CONSTRAINT "track_external_ids_track_id_provider_provider_id_pk" PRIMARY KEY("track_id","provider","provider_id")
);
--> statement-breakpoint
CREATE TABLE "track_folders" (
	"track_id" text NOT NULL,
	"folder_id" text NOT NULL,
	CONSTRAINT "track_folders_track_id_folder_id_pk" PRIMARY KEY("track_id","folder_id")
);
--> statement-breakpoint
CREATE TABLE "track_genres" (
	"track_id" text NOT NULL,
	"genre_id" text NOT NULL,
	CONSTRAINT "track_genres_track_id_genre_id_pk" PRIMARY KEY("track_id","genre_id")
);
--> statement-breakpoint
CREATE TABLE "track_subgenres" (
	"track_id" text NOT NULL,
	"subgenre_id" text NOT NULL,
	CONSTRAINT "track_subgenres_track_id_subgenre_id_pk" PRIMARY KEY("track_id","subgenre_id")
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"bpm" real,
	"musical_key" text,
	"duration_sec" integer,
	"energy" real,
	"artwork_url" text,
	"release_date" text,
	"library_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transitions" (
	"id" text PRIMARY KEY NOT NULL,
	"from_track_id" text NOT NULL,
	"to_track_id" text NOT NULL,
	"proposal_key" text,
	"source_note_id" text,
	"source_note_version" integer,
	"source_proposal_id" text,
	"confidence" real,
	"from_bar" integer,
	"to_bar" integer,
	"bars_overlap" integer,
	"technique" text,
	"intent" text,
	"quality" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "track_artists" ADD CONSTRAINT "track_artists_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_artists" ADD CONSTRAINT "track_artists_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_external_ids" ADD CONSTRAINT "track_external_ids_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_folders" ADD CONSTRAINT "track_folders_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_folders" ADD CONSTRAINT "track_folders_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_genres" ADD CONSTRAINT "track_genres_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_genres" ADD CONSTRAINT "track_genres_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_subgenres" ADD CONSTRAINT "track_subgenres_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_subgenres" ADD CONSTRAINT "track_subgenres_subgenre_id_subgenres_id_fk" FOREIGN KEY ("subgenre_id") REFERENCES "public"."subgenres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transitions" ADD CONSTRAINT "transitions_from_track_id_tracks_id_fk" FOREIGN KEY ("from_track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transitions" ADD CONSTRAINT "transitions_to_track_id_tracks_id_fk" FOREIGN KEY ("to_track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transitions" ADD CONSTRAINT "transitions_source_note_id_notes_id_fk" FOREIGN KEY ("source_note_id") REFERENCES "public"."notes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transitions" ADD CONSTRAINT "transitions_source_proposal_id_note_proposals_id_fk" FOREIGN KEY ("source_proposal_id") REFERENCES "public"."note_proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "artists_name_normalized_uidx" ON "artists" USING btree ("name_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "folders_name_normalized_uidx" ON "folders" USING btree ("name_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "genres_name_normalized_uidx" ON "genres" USING btree ("name_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "subgenres_name_normalized_uidx" ON "subgenres" USING btree ("name_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "track_external_ids_provider_provider_id_uidx" ON "track_external_ids" USING btree ("provider","provider_id");--> statement-breakpoint
CREATE INDEX "tracks_title_idx" ON "tracks" USING btree ("title");--> statement-breakpoint
CREATE INDEX "tracks_created_at_idx" ON "tracks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tracks_updated_at_idx" ON "tracks" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transitions_proposal_key_uidx" ON "transitions" USING btree ("proposal_key") WHERE "transitions"."proposal_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "transitions_from_track_id_idx" ON "transitions" USING btree ("from_track_id");--> statement-breakpoint
CREATE INDEX "transitions_to_track_id_idx" ON "transitions" USING btree ("to_track_id");