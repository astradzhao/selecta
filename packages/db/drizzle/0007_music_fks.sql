-- Clear Neo4j-only orphans before adding FKs (local single-user app; acceptable data loss).
DELETE FROM "note_track_links"
WHERE "track_id" IS NOT NULL
  AND "track_id" NOT IN (SELECT "id" FROM "tracks");--> statement-breakpoint
UPDATE "note_transition_commits"
SET "from_track_id" = NULL
WHERE "from_track_id" IS NOT NULL
  AND "from_track_id" NOT IN (SELECT "id" FROM "tracks");--> statement-breakpoint
UPDATE "note_transition_commits"
SET "to_track_id" = NULL
WHERE "to_track_id" IS NOT NULL
  AND "to_track_id" NOT IN (SELECT "id" FROM "tracks");--> statement-breakpoint
ALTER TABLE "note_track_links" ADD CONSTRAINT "note_track_links_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_transition_commits" ADD CONSTRAINT "note_transition_commits_from_track_id_tracks_id_fk" FOREIGN KEY ("from_track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_transition_commits" ADD CONSTRAINT "note_transition_commits_to_track_id_tracks_id_fk" FOREIGN KEY ("to_track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;
