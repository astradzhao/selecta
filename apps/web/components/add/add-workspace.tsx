"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { PageHeader } from "@selecta/ui/components/page-header";
import { SegmentedTab, SegmentedTabs } from "@selecta/ui/components/segmented-tabs";

import { NewNoteForm } from "@/components/add/new-note-form";
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
      <PageHeader title="Add" description={active.description}>
        <SegmentedTabs aria-label="Add modes">
          {MODES.map((item) => {
            const isActive = item.id === mode;
            const href = item.id === "track" ? "/add" : `/add?mode=${item.id}`;
            return (
              <SegmentedTab
                key={item.id}
                asChild
                active={isActive}
                onClick={(event) => {
                  event.preventDefault();
                  setMode(item.id);
                }}
              >
                <Link href={href}>{item.label}</Link>
              </SegmentedTab>
            );
          })}
        </SegmentedTabs>
      </PageHeader>

      {mode === "track" ? <AddTrackFlow /> : null}
      {mode === "transition" ? <NewNoteForm /> : null}
    </div>
  );
}
