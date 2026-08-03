import { AppShell } from "@/components/app-shell";
import { LibraryList } from "@/components/tracks/library-list";

export default function LibraryPage() {
  return (
    <AppShell currentPath="/library">
      <LibraryList />
    </AppShell>
  );
}
