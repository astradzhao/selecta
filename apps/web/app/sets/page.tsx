import { AppShell } from "@/components/app-shell";
import { SequencesBrowse } from "@/components/sequences/sequences-browse";
import { parseSetsView } from "@/lib/sequences/view";

type PageProps = {
  searchParams: Promise<{ view?: string }>;
};

export default async function SetsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const view = parseSetsView(params.view);

  return (
    <AppShell currentPath="/sets">
      <SequencesBrowse view={view} />
    </AppShell>
  );
}
