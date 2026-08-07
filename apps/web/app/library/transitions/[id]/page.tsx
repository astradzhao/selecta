import { AppShell } from "@/components/app-shell";
import { TransitionDetail } from "@/components/library/transition-detail";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function LibraryTransitionDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <AppShell currentPath="/library">
      <TransitionDetail transitionId={id} />
    </AppShell>
  );
}
