import { AppShell } from "@/components/app-shell";
import { NoteDetail } from "@/components/notes/note-detail";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function LibrarySubmissionDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <AppShell currentPath="/library">
      <NoteDetail noteId={id} readOnly />
    </AppShell>
  );
}
