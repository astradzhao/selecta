import { and, asc, eq } from "drizzle-orm";

import { getDb } from "@selecta/db";
import { SubmissionsError } from "./errors";
import { getSubmissionById } from "./submissions";
import { getTrackSummariesByIds } from "@selecta/library";
import { submissionTrackLinks, tracks, type SubmissionTrackLink } from "@selecta/db/schema";
import type { TrackSummary } from "@selecta/library";

export type AddSubmissionTrackLinkInput = {
  trackId: string;
  role?: string | null;
};

export type SubmissionTrackLinkWithTrack = {
  link: SubmissionTrackLink;
  track: TrackSummary | null;
};

function requireTrackId(trackId: string): string {
  const trimmed = trackId.trim();
  if (!trimmed) {
    throw new SubmissionsError("invalid_input", "trackId is required.");
  }
  return trimmed;
}

function normalizeRole(role: string | null | undefined): string | null {
  if (role == null) return null;
  const trimmed = role.trim();
  return trimmed || null;
}

/** List manual track links for a submission (stable order by createdAt). */
export async function listSubmissionTrackLinks(
  submissionId: string,
): Promise<SubmissionTrackLink[]> {
  const submission = await getSubmissionById(submissionId);
  if (!submission) {
    throw new SubmissionsError("not_found", `Submission "${submissionId.trim()}" was not found.`);
  }

  return getDb()
    .select()
    .from(submissionTrackLinks)
    .where(eq(submissionTrackLinks.submissionId, submission.id))
    .orderBy(asc(submissionTrackLinks.createdAt));
}

/**
 * List submission track links with library track summaries via a tracks LEFT JOIN
 * (orphans after Neo4j-era ids yield track: null until cleaned by FK migration).
 */
export async function listSubmissionTrackLinksWithTracks(
  submissionId: string,
): Promise<SubmissionTrackLinkWithTrack[]> {
  const submission = await getSubmissionById(submissionId);
  if (!submission) {
    throw new SubmissionsError("not_found", `Submission "${submissionId.trim()}" was not found.`);
  }

  const rows = await getDb()
    .select({
      link: submissionTrackLinks,
      trackId: tracks.id,
    })
    .from(submissionTrackLinks)
    .leftJoin(tracks, eq(submissionTrackLinks.trackId, tracks.id))
    .where(eq(submissionTrackLinks.submissionId, submission.id))
    .orderBy(asc(submissionTrackLinks.createdAt));

  const presentIds = rows
    .map((row) => row.trackId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const summaries =
    presentIds.length > 0
      ? await getTrackSummariesByIds(presentIds)
      : new Map<string, TrackSummary>();

  return rows.map((row) => ({
    link: row.link,
    track: row.trackId ? (summaries.get(row.trackId) ?? null) : null,
  }));
}

/**
 * Add a manual submission → track link.
 * Caller must validate that `trackId` exists in the music store before calling.
 * Idempotent for the same (submissionId, trackId): returns the existing row.
 */
export async function addSubmissionTrackLink(
  submissionId: string,
  input: AddSubmissionTrackLinkInput,
): Promise<{ link: SubmissionTrackLink; created: boolean }> {
  const submission = await getSubmissionById(submissionId);
  if (!submission) {
    throw new SubmissionsError("not_found", `Submission "${submissionId.trim()}" was not found.`);
  }

  const trackId = requireTrackId(input.trackId);
  const role = normalizeRole(input.role);

  const [existing] = await getDb()
    .select()
    .from(submissionTrackLinks)
    .where(
      and(
        eq(submissionTrackLinks.submissionId, submission.id),
        eq(submissionTrackLinks.trackId, trackId),
      ),
    )
    .limit(1);

  if (existing) {
    if (role !== existing.role) {
      const [updated] = await getDb()
        .update(submissionTrackLinks)
        .set({ role })
        .where(eq(submissionTrackLinks.id, existing.id))
        .returning();
      return { link: updated ?? existing, created: false };
    }
    return { link: existing, created: false };
  }

  const [track] = await getDb()
    .select({ id: tracks.id })
    .from(tracks)
    .where(eq(tracks.id, trackId))
    .limit(1);
  if (!track) {
    throw new SubmissionsError("not_found", `Track "${trackId}" was not found.`);
  }

  const [row] = await getDb()
    .insert(submissionTrackLinks)
    .values({ submissionId: submission.id, trackId, role })
    .returning();

  if (!row) {
    throw new SubmissionsError("invalid_input", "Failed to create submission track link.");
  }
  return { link: row, created: true };
}

/** Remove a manual submission → track link. */
export async function removeSubmissionTrackLink(
  submissionId: string,
  trackId: string,
): Promise<void> {
  const submission = await getSubmissionById(submissionId);
  if (!submission) {
    throw new SubmissionsError("not_found", `Submission "${submissionId.trim()}" was not found.`);
  }

  const targetTrackId = requireTrackId(trackId);
  const deleted = await getDb()
    .delete(submissionTrackLinks)
    .where(
      and(
        eq(submissionTrackLinks.submissionId, submission.id),
        eq(submissionTrackLinks.trackId, targetTrackId),
      ),
    )
    .returning({ id: submissionTrackLinks.id });

  if (deleted.length === 0) {
    throw new SubmissionsError(
      "not_found",
      `Track link "${targetTrackId}" was not found on submission "${submission.id}".`,
    );
  }
}
