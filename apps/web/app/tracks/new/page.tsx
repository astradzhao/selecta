import { AppShell } from "@/components/app-shell";
import { AddSongFlow } from "@/components/songs/add-song-flow";

export default function AddSongPage() {
  return (
    <AppShell currentPath="/songs/new">
      <AddSongFlow />
    </AppShell>
  );
}
