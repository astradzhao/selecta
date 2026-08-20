"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ListSkeleton } from "@selecta/ui/components/list-skeleton";
import { PageHeader } from "@selecta/ui/components/page-header";
import { SegmentedTab, SegmentedTabs } from "@selecta/ui/components/segmented-tabs";

import { AddNewButton } from "@/components/common/add-new-button";
import { LibraryList } from "@/components/tracks/library-list";
import { SubmissionsList } from "@/components/library/submissions-list";
import { TransitionsList } from "@/components/library/transitions-list";
import { libraryAddHref, libraryViewHref } from "@/lib/library/add-routes";
import { listProposals } from "@/lib/proposals/api";
import { type LibraryView } from "@/lib/library/view";

const VIEWS: Array<{ id: LibraryView; label: string; description: string }> = [
  {
    id: "tracks",
    label: "Tracks",
    description: "Search your tracks or narrow the list by Subgenre and Folder.",
  },
  {
    id: "transitions",
    label: "Transitions",
    description: "Browse committed transitions across your library.",
  },
  {
    id: "submissions",
    label: "Submissions",
    description: "Read-only raw inputs and the transitions they produced.",
  },
];

const ADD_ACTIONS: Record<LibraryView, { href: string; label: string }> = {
  tracks: { href: libraryAddHref("tracks"), label: "Add track" },
  transitions: { href: libraryAddHref("submissions", "transitions"), label: "Add transition" },
  submissions: { href: libraryAddHref("submissions"), label: "New submission" },
};

export function LibraryWorkspace({ view }: { view: LibraryView }) {
  const router = useRouter();
  const active = VIEWS.find((item) => item.id === view) ?? VIEWS[0]!;
  const [needsReviewCount, setNeedsReviewCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await listProposals({
          status: "needs_review,failed",
          limit: 50,
        });
        if (cancelled) return;
        setNeedsReviewCount(response.proposals.length);
      } catch {
        if (!cancelled) setNeedsReviewCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function setView(next: LibraryView) {
    router.replace(libraryViewHref(next));
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="Library"
        description={active.description}
        actions={
          needsReviewCount > 0 ? (
            <Link
              href={`${libraryViewHref("submissions")}&needsReview=1`}
              className="text-destructive text-sm font-medium underline-offset-4 hover:underline"
            >
              {needsReviewCount} need review
            </Link>
          ) : null
        }
      >
        <div className="space-y-4">
          <SegmentedTabs aria-label="Library views">
            {VIEWS.map((item) => {
              const isActive = item.id === view;
              const href = libraryViewHref(item.id);
              return (
                <SegmentedTab
                  key={item.id}
                  asChild
                  active={isActive}
                  onClick={(event) => {
                    event.preventDefault();
                    setView(item.id);
                  }}
                >
                  <Link href={href}>{item.label}</Link>
                </SegmentedTab>
              );
            })}
          </SegmentedTabs>
          <AddNewButton href={ADD_ACTIONS[view].href} label={ADD_ACTIONS[view].label} />
        </div>
      </PageHeader>

      {view === "tracks" ? <LibraryList /> : null}
      {view === "transitions" ? <TransitionsList /> : null}
      {view === "submissions" ? (
        <Suspense fallback={<ListSkeleton aria-label="Loading submissions" />}>
          <SubmissionsList />
        </Suspense>
      ) : null}
    </div>
  );
}
