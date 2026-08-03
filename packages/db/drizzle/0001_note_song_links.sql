CREATE TABLE "note_song_links" (
	"id" text PRIMARY KEY NOT NULL,
	"note_id" text NOT NULL,
	"song_id" text NOT NULL,
	"role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "note_song_links" ADD CONSTRAINT "note_song_links_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "note_song_links_note_id_song_id_uidx" ON "note_song_links" USING btree ("note_id","song_id");