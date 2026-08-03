import { AppShell } from "@/components/app-shell";
import { NewNoteForm } from "@/components/notes/new-note-form";

export default function NewNotePage() {
  return (
    <AppShell currentPath="/notes">
      <NewNoteForm />
    </AppShell>
  );
}
