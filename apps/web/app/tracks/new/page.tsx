import { AppShell } from "@/components/app-shell";
import { AddTrackFlow } from "@/components/tracks/add-track-flow";

export default function AddTrackPage() {
  return (
    <AppShell currentPath="/tracks/new">
      <AddTrackFlow />
    </AppShell>
  );
}
