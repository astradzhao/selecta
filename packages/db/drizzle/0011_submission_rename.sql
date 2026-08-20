ALTER TYPE "public"."note_extraction_status" RENAME TO "submission_extraction_status";--> statement-breakpoint
ALTER TYPE "public"."note_agent_run_status" RENAME TO "submission_agent_run_status";--> statement-breakpoint
ALTER TYPE "public"."note_transition_commit_status" RENAME TO "submission_transition_commit_status";--> statement-breakpoint
ALTER TYPE "public"."note_proposal_status" RENAME TO "submission_proposal_status";--> statement-breakpoint
ALTER TABLE "notes" RENAME TO "submissions";--> statement-breakpoint
ALTER TABLE "note_track_links" RENAME TO "submission_track_links";--> statement-breakpoint
ALTER TABLE "note_agent_runs" RENAME TO "submission_agent_runs";--> statement-breakpoint
ALTER TABLE "note_proposals" RENAME TO "submission_proposals";--> statement-breakpoint
ALTER TABLE "note_transition_commits" RENAME TO "submission_transition_commits";--> statement-breakpoint
ALTER TABLE "submission_track_links" RENAME COLUMN "note_id" TO "submission_id";--> statement-breakpoint
ALTER TABLE "submission_agent_runs" RENAME COLUMN "note_id" TO "submission_id";--> statement-breakpoint
ALTER TABLE "submission_proposals" RENAME COLUMN "note_id" TO "submission_id";--> statement-breakpoint
ALTER TABLE "submission_transition_commits" RENAME COLUMN "note_id" TO "submission_id";--> statement-breakpoint
ALTER TABLE "transitions" RENAME COLUMN "source_note_id" TO "source_submission_id";--> statement-breakpoint
ALTER TABLE "transitions" RENAME COLUMN "source_note_version" TO "source_submission_version";--> statement-breakpoint
ALTER INDEX "note_track_links_note_id_track_id_uidx" RENAME TO "submission_track_links_submission_id_track_id_uidx";--> statement-breakpoint
ALTER INDEX "note_agent_runs_note_version_attempt_uidx" RENAME TO "submission_agent_runs_submission_version_attempt_uidx";--> statement-breakpoint
ALTER INDEX "note_proposals_proposal_key_uidx" RENAME TO "submission_proposals_proposal_key_uidx";--> statement-breakpoint
ALTER INDEX "note_proposals_note_version_fingerprint_uidx" RENAME TO "submission_proposals_submission_version_fingerprint_uidx";--> statement-breakpoint
ALTER INDEX "note_proposals_status_updated_idx" RENAME TO "submission_proposals_status_updated_idx";--> statement-breakpoint
ALTER INDEX "note_proposals_fingerprint_idx" RENAME TO "submission_proposals_fingerprint_idx";--> statement-breakpoint
ALTER INDEX "note_transition_commits_proposal_key_uidx" RENAME TO "submission_transition_commits_proposal_key_uidx";--> statement-breakpoint
ALTER TABLE "submission_track_links" RENAME CONSTRAINT "note_track_links_note_id_notes_id_fk" TO "submission_track_links_submission_id_submissions_id_fk";--> statement-breakpoint
ALTER TABLE "submission_track_links" RENAME CONSTRAINT "note_track_links_track_id_tracks_id_fk" TO "submission_track_links_track_id_tracks_id_fk";--> statement-breakpoint
ALTER TABLE "submission_agent_runs" RENAME CONSTRAINT "note_agent_runs_note_id_notes_id_fk" TO "submission_agent_runs_submission_id_submissions_id_fk";--> statement-breakpoint
ALTER TABLE "submission_proposals" RENAME CONSTRAINT "note_proposals_note_id_notes_id_fk" TO "submission_proposals_submission_id_submissions_id_fk";--> statement-breakpoint
ALTER TABLE "submission_proposals" RENAME CONSTRAINT "note_proposals_agent_run_id_note_agent_runs_id_fk" TO "submission_proposals_agent_run_id_submission_agent_runs_id_fk";--> statement-breakpoint
ALTER TABLE "submission_transition_commits" RENAME CONSTRAINT "note_transition_commits_note_id_notes_id_fk" TO "submission_transition_commits_submission_id_submissions_id_fk";--> statement-breakpoint
ALTER TABLE "submission_transition_commits" RENAME CONSTRAINT "note_transition_commits_from_track_id_tracks_id_fk" TO "submission_transition_commits_from_track_id_tracks_id_fk";--> statement-breakpoint
ALTER TABLE "submission_transition_commits" RENAME CONSTRAINT "note_transition_commits_to_track_id_tracks_id_fk" TO "submission_transition_commits_to_track_id_tracks_id_fk";--> statement-breakpoint
ALTER TABLE "proposal_review_events" RENAME CONSTRAINT "proposal_review_events_proposal_id_note_proposals_id_fk" TO "proposal_review_events_proposal_id_submission_proposals_id_fk";--> statement-breakpoint
ALTER TABLE "transitions" RENAME CONSTRAINT "transitions_source_note_id_notes_id_fk" TO "transitions_source_submission_id_submissions_id_fk";--> statement-breakpoint
ALTER TABLE "transitions" RENAME CONSTRAINT "transitions_source_proposal_id_note_proposals_id_fk" TO "transitions_source_proposal_id_submission_proposals_id_fk";--> statement-breakpoint
ALTER TABLE "submissions" RENAME CONSTRAINT "notes_pkey" TO "submissions_pkey";--> statement-breakpoint
ALTER TABLE "submission_track_links" RENAME CONSTRAINT "note_track_links_pkey" TO "submission_track_links_pkey";--> statement-breakpoint
ALTER TABLE "submission_agent_runs" RENAME CONSTRAINT "note_agent_runs_pkey" TO "submission_agent_runs_pkey";--> statement-breakpoint
ALTER TABLE "submission_proposals" RENAME CONSTRAINT "note_proposals_pkey" TO "submission_proposals_pkey";--> statement-breakpoint
ALTER TABLE "submission_transition_commits" RENAME CONSTRAINT "note_transition_commits_pkey" TO "submission_transition_commits_pkey";
