"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "@selecta/ui/lib/utils";

import { NewNoteForm } from "@/components/notes/new-note-form";
import { AddTrackFlow } from "@/components/tracks/add-track-flow";
import { type AddMode } from "@/lib/add/mode";

const MODES: Array<{ id: AddMode; label: string; description: string }> = [
  {
    id: "track",
    label: "Track",
    description:
      "Search the catalog, review the hit, then tag with musical subgenres and organizational folders.",
  },
  {
    id: "transition",
    label: "Transition",
    description:
      "Paste free-form mix notes describing one or many transitions. Processing starts in the background.",
  },
];

export function AddWorkspace({ mode }: { mode: AddMode }) {
  const router = useRouter();
  const active = MODES.find((item) => item.id === mode) ?? MODES[0]!;

  function setMode(next: AddMode) {
    const href = next === "track" ? "/add" : `/add?mode=${next}`;
    router.replace(href);
  }

  return (
    <div className="space-y-10">
      <header className="border-border space-y-4 border-b pb-6">
        <div className="space-y-2">
          <h1 className="text-page-title">Add</h1>
          <p className="text-body text-muted-foreground max-w-xl">{active.description}</p>
        </div>
        <nav aria-label="Add modes" className="flex flex-wrap gap-1">
          {MODES.map((item) => {
            const isActive = item.id === mode;
            const href = item.id === "track" ? "/add" : `/add?mode=${item.id}`;
            return (
              <Link
                key={item.id}
                href={href}
                onClick={(event) => {
                  event.preventDefault();
                  setMode(item.id);
                }}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-selected text-selected-foreground"
                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {mode === "track" ? <AddTrackFlow embedded /> : null}
      {mode === "transition" ? <NewNoteForm embedded /> : null}
    </div>
  );
}
