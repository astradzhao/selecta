import { AppShell } from "@/components/app-shell";
import { AddWorkspace, parseAddMode } from "@/components/add/add-workspace";

type PageProps = {
  searchParams: Promise<{ mode?: string }>;
};

export default async function AddPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const mode = parseAddMode(params.mode);

  return (
    <AppShell currentPath="/add">
      <AddWorkspace mode={mode} />
    </AppShell>
  );
}
