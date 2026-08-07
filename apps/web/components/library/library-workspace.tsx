"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "@selecta/ui/lib/utils";

import { LibraryList } from "@/components/tracks/library-list";
import { SubmissionsList } from "@/components/library/submissions-list";
import { TransitionsList } from "@/components/library/transitions-list";

export type LibraryView = "tracks" | "transitions" | "submissions";

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

export function parseLibraryView(raw: string | undefined | null): LibraryView {
  if (raw === "transitions" || raw === "submissions") return raw;
  return "tracks";
}

export function LibraryWorkspace({ view }: { view: LibraryView }) {
  const router = useRouter();
  const active = VIEWS.find((item) => item.id === view) ?? VIEWS[0]!;

  function setView(next: LibraryView) {
    const href = next === "tracks" ? "/library" : `/library?view=${next}`;
    router.replace(href);
  }

  return (
    <div className="space-y-10">
      <header className="border-border space-y-4 border-b pb-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Library</h1>
          <p className="text-muted-foreground max-w-xl text-sm">{active.description}</p>
        </div>
        <nav aria-label="Library views" className="flex flex-wrap gap-1">
          {VIEWS.map((item) => {
            const isActive = item.id === view;
            const href = item.id === "tracks" ? "/library" : `/library?view=${item.id}`;
            return (
              <Link
                key={item.id}
                href={href}
                onClick={(event) => {
                  event.preventDefault();
                  setView(item.id);
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {view === "tracks" ? <LibraryList embedded /> : null}
      {view === "transitions" ? <TransitionsList /> : null}
      {view === "submissions" ? <SubmissionsList /> : null}
    </div>
  );
}
