import { AppShell } from "@/components/app-shell";
import { AddPageShell } from "@/components/add/add-page-shell";
import { ManualTransitionForm } from "@/components/add/manual-transition-form";
import { libraryAddBackHref } from "@/lib/library/add-routes";

type PageProps = {
  searchParams: Promise<{ from?: string; fromTrackId?: string; toTrackId?: string }>;
};

export default async function AddTransitionPage({ searchParams }: PageProps) {
  const { from, fromTrackId, toTrackId } = await searchParams;
  const backHref = libraryAddBackHref(from, "transitions");

  return (
    <AppShell currentPath="/library">
      <AddPageShell
        title="Add a transition"
        description="Pick two tracks and the mix. Nothing is sent to the model."
        backHref={backHref}
        backLabel="Back to library"
      >
        <ManualTransitionForm backHref={backHref} fromTrackId={fromTrackId} toTrackId={toTrackId} />
      </AddPageShell>
    </AppShell>
  );
}
