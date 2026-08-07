import { AppShell } from "@/components/app-shell";
import { AddWorkspace } from "@/components/add/add-workspace";
import { parseAddMode } from "@/lib/add/mode";

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
