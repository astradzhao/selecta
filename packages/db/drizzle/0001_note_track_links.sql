CREATE TABLE "note_track_links" (
	"id" text PRIMARY KEY NOT NULL,
	"note_id" text NOT NULL,
	"track_id" text NOT NULL,
	"role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "note_track_links" ADD CONSTRAINT "note_track_links_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "note_track_links_note_id_track_id_uidx" ON "note_track_links" USING btree ("note_id","track_id");
