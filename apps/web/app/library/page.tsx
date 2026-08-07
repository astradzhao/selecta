import { AppShell } from "@/components/app-shell";
import { LibraryWorkspace } from "@/components/library/library-workspace";
import { parseLibraryView } from "@/lib/library/view";

type PageProps = {
  searchParams: Promise<{ view?: string }>;
};

export default async function LibraryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const view = parseLibraryView(params.view);

  return (
    <AppShell currentPath="/library">
      <LibraryWorkspace view={view} />
    </AppShell>
  );
}
