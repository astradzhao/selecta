"use client";

type NoteExtractionDebugProps = {
  extraction: Record<string, unknown> | null;
  rawResponse: Record<string, unknown> | null;
};

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value == null) {
    return (
      <div className="space-y-1">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
        <p className="text-muted-foreground text-xs">null</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      <pre className="border-border bg-background max-h-80 overflow-auto rounded-md border p-3 text-xs leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

/**
 * DEV_MODE-only view of model draft + resolve/policy artifacts already stored on the note.
 */
export function NoteExtractionDebug({ extraction, rawResponse }: NoteExtractionDebugProps) {
  const draft = extraction && "draft" in extraction ? extraction.draft : null;
  const plan = extraction && "plan" in extraction ? extraction.plan : null;
  const candidates =
    extraction && "candidatesByMentionId" in extraction ? extraction.candidatesByMentionId : null;
  const policy = extraction && "policy" in extraction ? extraction.policy : null;

  return (
    <details className="border-border bg-muted/20 open:bg-muted/30 rounded-lg border px-3 py-3">
      <summary className="cursor-pointer text-sm font-medium select-none">
        Debug · model output
      </summary>
      <div className="mt-3 space-y-4">
        <p className="text-muted-foreground text-xs">
          Visible because <code className="text-foreground">DEV_MODE</code> is on. Draft is the raw
          LLM JSON; plan/candidates are after library → Spotify resolve.
        </p>
        <JsonBlock label="Model draft" value={draft} />
        <JsonBlock label="Resolved plan" value={plan} />
        <JsonBlock label="Candidates by mention" value={candidates} />
        <JsonBlock label="Policy" value={policy} />
        <JsonBlock label="Raw response meta" value={rawResponse} />
      </div>
    </details>
  );
}
