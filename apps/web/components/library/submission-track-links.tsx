"use client";

import { useState, useTransition } from "react";
import { XIcon } from "lucide-react";

import { Alert } from "@selecta/ui/components/alert";
import { Button } from "@selecta/ui/components/button";
import { DataList, DataListRow } from "@selecta/ui/components/data-list";
import { EmptyState } from "@selecta/ui/components/empty-state";
import { Field, FieldLabel } from "@selecta/ui/components/field";
import { SectionHeading } from "@selecta/ui/components/section-heading";

import { TrackPicker } from "@/components/tracks/track-picker";
import { TrackRow } from "@/components/tracks/track-row";
import { describeApiError } from "@/lib/api/errors";
import {
  addSubmissionTrackLink,
  removeSubmissionTrackLink,
  type ApiSubmissionTrackLink,
} from "@/lib/submissions/api";
import type { ApiTrack } from "@/lib/tracks/api";
import { rowFromApiTrack } from "@/lib/tracks/track-row-item";

export function SubmissionTrackLinks({
  submissionId,
  initialLinks,
  onLinksChange,
}: {
  submissionId: string;
  initialLinks: ApiSubmissionTrackLink[];
  onLinksChange?: (links: ApiSubmissionTrackLink[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mutating, startMutate] = useTransition();
  const linkedIds = initialLinks.map((link) => link.trackId);

  function updateLinks(next: ApiSubmissionTrackLink[]) {
    onLinksChange?.(next);
  }

  function linkTrack(track: ApiTrack) {
    startMutate(async () => {
      try {
        const response = await addSubmissionTrackLink(submissionId, { trackId: track.id });
        updateLinks(response.trackLinks);
        setQuery("");
        setError(null);
      } catch (err) {
        setError(describeApiError(err, { fallback: "Failed to link track. Is the API running?" }));
      }
    });
  }

  function unlinkTrack(trackId: string) {
    startMutate(async () => {
      try {
        const response = await removeSubmissionTrackLink(submissionId, trackId);
        updateLinks(response.trackLinks);
        setError(null);
      } catch (err) {
        setError(
          describeApiError(err, { fallback: "Failed to unlink track. Is the API running?" }),
        );
      }
    });
  }

  return (
    <section aria-label="Linked tracks" className="space-y-4">
      <SectionHeading
        title="Linked tracks"
        hint="Optionally attach existing library tracks. Links are manual — parsing never adds them silently."
      />

      <DataList>
        {initialLinks.map((link) => (
          <TrackRow
            key={link.id}
            item={
              link.track
                ? rowFromApiTrack(link.track)
                : { key: link.trackId, title: "Track unavailable", artists: [link.trackId] }
            }
            size="sm"
            interaction="static"
            titleHref={link.track ? `/tracks/${link.track.id}` : undefined}
            trailing={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={mutating}
                onClick={() => unlinkTrack(link.trackId)}
                aria-label={`Unlink ${link.track?.title ?? link.trackId}`}
              >
                <XIcon />
                Remove
              </Button>
            }
          />
        ))}
        {initialLinks.length === 0 ? (
          <DataListRow interactive={false}>
            <EmptyState compact className="rounded-none border-0">
              No tracks linked yet.
            </EmptyState>
          </DataListRow>
        ) : null}
      </DataList>

      <Field>
        <FieldLabel htmlFor="submission-link-track-search">Add track from library</FieldLabel>
        <TrackPicker
          id="submission-link-track-search"
          source="library"
          query={query}
          onQueryChange={(next) => {
            setQuery(next);
            setError(null);
          }}
          excludeIds={linkedIds}
          limit={8}
          minQueryLength={1}
          size="sm"
          interaction="add"
          disabled={mutating}
          busy="hide"
          emptyFiltered="No matching tracks."
          onSelect={linkTrack}
        />
      </Field>

      {error ? <Alert variant="destructive">{error}</Alert> : null}
    </section>
  );
}
