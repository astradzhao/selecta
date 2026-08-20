import type { SubmissionExtractionStatus, SubmissionProposalStatus } from "@selecta/db";
import { Badge } from "@selecta/ui/components/badge";
import { cn } from "@selecta/ui/lib/utils";

import { extractionStatus } from "@/lib/submissions/extraction-status";
import { proposalStatus } from "@/lib/proposals/proposal-status";
import { toneToBadgeVariant, type StatusDisplay } from "@/lib/status";

export function StatusBadge({
  display,
  className,
}: {
  display: StatusDisplay;
  className?: string;
}) {
  return (
    <Badge
      variant={toneToBadgeVariant(display.tone)}
      className={cn(display.inProgress && "motion-safe:animate-pulse", className)}
    >
      {display.label}
    </Badge>
  );
}

export function ExtractionStatusBadge({
  status,
  className,
}: {
  status: SubmissionExtractionStatus;
  className?: string;
}) {
  return <StatusBadge display={extractionStatus(status)} className={className} />;
}

export function ProposalStatusBadge({
  status,
  className,
}: {
  status: SubmissionProposalStatus;
  className?: string;
}) {
  return <StatusBadge display={proposalStatus(status)} className={className} />;
}
