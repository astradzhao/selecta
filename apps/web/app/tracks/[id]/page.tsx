import { AppShell } from "@/components/app-shell";
import { TrackDetail } from "@/components/tracks/track-detail";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TrackDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <AppShell currentPath="/library">
      <TrackDetail trackId={id} />
    </AppShell>
  );
}
