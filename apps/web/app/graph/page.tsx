import { AppShell } from "@/components/app-shell";
import { GraphSession } from "@/components/graph/graph-session";

type PageProps = {
  searchParams: Promise<{
    track?: string | string[];
    set?: string | string[];
    version?: string | string[];
    step?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value) && value[0]?.trim()) return value[0].trim();
  return null;
}

export default async function GraphPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialSetId = firstParam(params.set);
  const initialTrackId = initialSetId ? null : firstParam(params.track);

  return (
    <AppShell currentPath="/graph">
      <GraphSession
        initialTrackId={initialTrackId}
        initialSetId={initialSetId}
        initialVersionId={firstParam(params.version)}
        initialStepId={firstParam(params.step)}
      />
    </AppShell>
  );
}
