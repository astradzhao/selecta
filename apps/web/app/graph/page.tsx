import { AppShell } from "@/components/app-shell";
import { GraphLanding } from "@/components/tracks/graph-landing";

export default function GraphPage() {
  return (
    <AppShell currentPath="/graph">
      <GraphLanding />
    </AppShell>
  );
}
