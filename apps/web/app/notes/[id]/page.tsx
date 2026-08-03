import { AppShell } from "@/components/app-shell";
import { NoteDetail } from "@/components/notes/note-detail";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function NoteDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <AppShell currentPath="/notes">
      <NoteDetail noteId={id} />
    </AppShell>
  );
}
