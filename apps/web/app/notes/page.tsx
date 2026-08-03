import { AppShell } from "@/components/app-shell";
import { NotesList } from "@/components/notes/notes-list";

export default function NotesPage() {
  return (
    <AppShell currentPath="/notes">
      <NotesList />
    </AppShell>
  );
}
