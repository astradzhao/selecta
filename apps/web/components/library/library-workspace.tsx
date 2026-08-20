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
import { getLibraryStats } from "@/lib/tracks/api";
import { type LibraryView } from "@/lib/library/view";

const VIEWS: Array<{ id: LibraryView; label: string }> = [
  { id: "tracks", label: "Tracks" },
  { id: "transitions", label: "Transitions" },
  { id: "submissions", label: "Submissions" },
];

const ADD_ACTIONS: Record<LibraryView, { href: string; label: string }> = {
  tracks: { href: libraryAddHref("tracks"), label: "Add track" },
  transitions: { href: libraryAddHref("submissions", "transitions"), label: "Add transition" },
  submissions: { href: libraryAddHref("submissions"), label: "New submission" },
};

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span>
      <span className="text-foreground text-numeric font-medium">{value}</span> {label}
    </span>
  );
}

function CrateStats({
  stats,
  needsReviewCount,
}: {
  stats: { count: number; transitionCount: number; deadEndCount: number } | null;
  needsReviewCount: number;
}) {
  if (!stats) {
    return <span className="invisible">0 tracks</span>;
  }

  return (
    <p className="flex flex-wrap items-center gap-2">
      <Stat value={stats.count} label={stats.count === 1 ? "track" : "tracks"} />
      <span aria-hidden="true" className="opacity-40">
        ·
      </span>
      <Stat
        value={stats.transitionCount}
        label={stats.transitionCount === 1 ? "transition" : "transitions"}
      />
      <span aria-hidden="true" className="opacity-40">
        ·
      </span>
      <Stat
        value={stats.deadEndCount}
        label={stats.deadEndCount === 1 ? "dead end" : "dead ends"}
      />
      {needsReviewCount > 0 ? (
        <>
          <span aria-hidden="true" className="opacity-40">
            ·
          </span>
          <Link
            href={`${libraryViewHref("submissions")}&needsReview=1`}
            className="text-destructive font-medium underline-offset-4 hover:underline"
          >
            {needsReviewCount} need review
          </Link>
        </>
      ) : null}
    </p>
  );
}

export function LibraryWorkspace({ view }: { view: LibraryView }) {
  const router = useRouter();
  const [needsReviewCount, setNeedsReviewCount] = useState(0);
  const [stats, setStats] = useState<{
    count: number;
    transitionCount: number;
    deadEndCount: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const crate = await getLibraryStats();
        if (cancelled) return;
        setStats({
          count: crate.count,
          transitionCount: crate.transitionCount,
          deadEndCount: crate.deadEndCount,
        });
      } catch {
        if (!cancelled) setStats(null);
      }
    })();
    void (async () => {
      try {
        const response = await listProposals({
          status: "needs_review,failed",
          limit: 50,
        });
        if (!cancelled) setNeedsReviewCount(response.proposals.length);
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
    <div className="space-y-4">
      <PageHeader
        title="Library"
        description={<CrateStats stats={stats} needsReviewCount={needsReviewCount} />}
        className="space-y-6 border-b-0 pb-0"
        actions={<AddNewButton href={ADD_ACTIONS[view].href} label={ADD_ACTIONS[view].label} />}
      >
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
