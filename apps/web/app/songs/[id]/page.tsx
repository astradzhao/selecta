import { AppShell } from "@/components/app-shell";
import { SongDetail } from "@/components/songs/song-detail";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SongDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <AppShell currentPath="/library">
      <SongDetail songId={id} />
    </AppShell>
  );
}
