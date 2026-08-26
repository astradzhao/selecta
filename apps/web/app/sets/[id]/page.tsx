import { AppShell } from "@/components/app-shell";
import { SequenceWorkspace } from "@/components/sequences/sequence-workspace";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SetWorkspacePage({ params }: PageProps) {
  const { id } = await params;
  return (
    <AppShell currentPath="/sets" width="wide" density="workspace">
      <SequenceWorkspace sequenceId={id} routeKind="set" />
    </AppShell>
  );
}
