import { AppShell } from "@/components/app-shell";
import { LibraryWorkspace, parseLibraryView } from "@/components/library/library-workspace";

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
