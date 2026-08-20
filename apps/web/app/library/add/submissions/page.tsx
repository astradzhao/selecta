import { AppShell } from "@/components/app-shell";
import { AddPageShell } from "@/components/add/add-page-shell";
import { NewSubmissionForm } from "@/components/add/new-submission-form";
import { libraryAddBackHref } from "@/lib/library/add-routes";

type PageProps = {
  searchParams: Promise<{ from?: string }>;
};

export default async function AddSubmissionPage({ searchParams }: PageProps) {
  const { from } = await searchParams;
  const backHref = libraryAddBackHref(from, "submissions");

  return (
    <AppShell currentPath="/library">
      <AddPageShell
        title="New submission"
        description="Paste free-form mix notes describing one or many transitions. Processing starts in the background."
        backHref={backHref}
        backLabel="Back to library"
      >
        <NewSubmissionForm backHref={backHref} />
      </AddPageShell>
    </AppShell>
  );
}
