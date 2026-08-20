import { AppShell } from "@/components/app-shell";
import { ProposalReview } from "@/components/library/proposal-review";

type PageProps = {
  params: Promise<{ id: string; proposalId: string }>;
};

export default async function LibraryProposalReviewPage({ params }: PageProps) {
  const { id, proposalId } = await params;
  return (
    <AppShell currentPath="/library">
      <ProposalReview submissionId={id} proposalId={proposalId} />
    </AppShell>
  );
}
