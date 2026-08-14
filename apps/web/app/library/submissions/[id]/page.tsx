import { AppShell } from "@/components/app-shell";
import { SubmissionDetail } from "@/components/library/submission-detail";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function LibrarySubmissionDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <AppShell currentPath="/library">
      <SubmissionDetail noteId={id} />
    </AppShell>
  );
}
