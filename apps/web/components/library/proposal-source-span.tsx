import { cn } from "@selecta/ui/lib/utils";

import { locateSpan } from "@/lib/proposals/span";

type HighlightSpan = {
  start: number;
  end: number;
  sourceText: string;
  mode?: "exact" | "search" | "standalone";
  emphasis?: "primary" | "dim";
};

function renderHighlightedText(rawText: string, spans: HighlightSpan[]) {
  const located = spans
    .map((span) => {
      if (span.mode === "standalone") return span;
      const locatedSpan = locateSpan(rawText, span.start, span.end, span.sourceText);
      return { ...locatedSpan, emphasis: span.emphasis };
    })
    .filter((span) => span.mode !== "standalone")
    .sort((a, b) => a.start - b.start);

  if (located.length === 0) {
    return <span>{rawText}</span>;
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const span of located) {
    if (span.start > cursor) {
      parts.push(<span key={`text-${cursor}`}>{rawText.slice(cursor, span.start)}</span>);
    }
    parts.push(
      <mark
        key={`mark-${span.start}-${span.end}`}
        className={cn(
          "rounded-sm px-0.5",
          span.emphasis === "primary"
            ? "bg-highlight text-highlight-foreground"
            : "bg-muted/80 text-muted-foreground",
        )}
      >
        {rawText.slice(span.start, span.end)}
      </mark>,
    );
    cursor = span.end;
  }

  if (cursor < rawText.length) {
    parts.push(<span key={`text-${cursor}`}>{rawText.slice(cursor)}</span>);
  }

  return parts;
}

export function ProposalSourceSpan({
  rawText,
  sourceStart,
  sourceEnd,
  sourceText,
  siblingSpans = [],
  className,
}: {
  rawText: string;
  sourceStart: number;
  sourceEnd: number;
  sourceText: string;
  siblingSpans?: Array<{ start: number; end: number; sourceText: string }>;
  className?: string;
}) {
  const primary = locateSpan(rawText, sourceStart, sourceEnd, sourceText);

  if (primary.mode === "standalone") {
    return (
      <div className={cn("space-y-2", className)}>
        <p className="text-muted-foreground text-xs">
          Couldn&apos;t locate this span in the submission text.
        </p>
        <p className="border-border bg-muted/20 rounded-md border px-3 py-2 text-sm whitespace-pre-wrap">
          {sourceText}
        </p>
      </div>
    );
  }

  const spans: HighlightSpan[] = [
    ...siblingSpans.map((span) => {
      const located = locateSpan(rawText, span.start, span.end, span.sourceText);
      return { ...located, sourceText: span.sourceText, emphasis: "dim" as const };
    }),
    { ...primary, sourceText, emphasis: "primary" },
  ];

  return (
    <p
      className={cn(
        "border-border bg-muted/20 rounded-md border px-3 py-2 text-sm whitespace-pre-wrap",
        className,
      )}
    >
      {renderHighlightedText(rawText, spans)}
    </p>
  );
}
