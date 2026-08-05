import { AppShell } from "@/components/app-shell";
import { GraphExplorer } from "@/components/tracks/graph-explorer";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TrackGraphPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <AppShell currentPath="/library">
      <GraphExplorer key={id} trackId={id} />
    </AppShell>
  );
}
