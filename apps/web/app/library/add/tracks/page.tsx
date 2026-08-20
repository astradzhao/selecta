import { AppShell } from "@/components/app-shell";
import { AddPageShell } from "@/components/add/add-page-shell";
import { AddTrackFlow } from "@/components/tracks/add-track-flow";
import { libraryAddBackHref } from "@/lib/library/add-routes";

type PageProps = {
  searchParams: Promise<{ from?: string }>;
};

export default async function AddTrackPage({ searchParams }: PageProps) {
  const { from } = await searchParams;
  const backHref = libraryAddBackHref(from, "tracks");

  return (
    <AppShell currentPath="/library">
      <AddPageShell
        title="Add a track"
        description="Search the catalog, confirm the details, then tag it with subgenres and folders."
        backHref={backHref}
        backLabel="Back to library"
      >
        <AddTrackFlow />
      </AddPageShell>
    </AppShell>
  );
}
