import type { NoteExtractionStatus } from "@/lib/notes/api";

export const SUBMISSION_STATUS_FILTER_OPTIONS: Array<{
  value: "" | NoteExtractionStatus;
  label: string;
}> = [
  { value: "", label: "Any status" },
  { value: "needs_review", label: "Needs review" },
  { value: "partially_committed", label: "Partially committed" },
  { value: "committed", label: "Committed" },
  { value: "extracting", label: "Processing" },
  { value: "failed", label: "Failed" },
  { value: "dismissed", label: "Dismissed" },
  { value: "commit_failed", label: "Commit failed" },
];

export function extractionStatusLabel(status: NoteExtractionStatus): string {
  switch (status) {
    case "extracting":
      return "Processing";
    case "no_proposal":
      return "No proposal";
    case "resolving":
      return "Resolving";
    case "needs_review":
      return "Needs review";
    case "committed":
      return "Committed";
    case "partially_committed":
      return "Partial";
    case "commit_failed":
      return "Commit failed";
    case "failed":
      return "Failed";
    case "dismissed":
      return "Dismissed";
    case "idle":
    default:
      return "Idle";
  }
}

export function extractionStatusVariant(
  status: NoteExtractionStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "needs_review" || status === "failed" || status === "commit_failed") {
    return "destructive";
  }
  if (status === "committed") return "secondary";
  if (status === "partially_committed") return "outline";
  return "outline";
}
