import { generateText, Output } from "ai";

import {
  buildExtractionMessages,
  DEFAULT_EXTRACTION_MODEL,
  getExtractionPromptMeta,
  type ExtractionPromptMeta,
} from "./extraction-prompt";
import {
  ExtractionProposalSchema,
  parseExtractionProposal,
  type ExtractionProposal,
} from "./extraction-schema";

export type ExtractNoteProposalsInput = {
  rawText: string;
  model?: string;
};

export type ExtractNoteProposalsResult = {
  proposal: ExtractionProposal;
  rawResponse: Record<string, unknown>;
  meta: ExtractionPromptMeta;
  provider: string;
};

/** Derive provider from an AI Gateway model id (`openai/gpt-4.1-mini` → `openai`). */
export function providerFromModel(model: string): string {
  const trimmed = model.trim();
  const slash = trimmed.indexOf("/");
  if (slash <= 0) {
    return "unknown";
  }
  return trimmed.slice(0, slash);
}

/**
 * Whether the validated proposal implies graph work for DJ-35+.
 * Song-only / unknown notes are valid `no_proposal` results (DJ-34).
 */
export function hasTransitionProposals(proposal: ExtractionProposal): boolean {
  return proposal.transitionProposals.length > 0;
}

/**
 * Run structured extraction via AI Gateway (`generateText` + Zod schema).
 * Does not touch Postgres — callers persist audit fields after success/failure.
 */
export async function extractNoteProposals(
  input: ExtractNoteProposalsInput,
): Promise<ExtractNoteProposalsResult> {
  const rawText = input.rawText.trim();
  if (!rawText) {
    throw new Error("rawText is required for extraction.");
  }

  const model = input.model?.trim() || DEFAULT_EXTRACTION_MODEL;
  const meta = getExtractionPromptMeta(model);
  const messages = buildExtractionMessages(rawText);

  const result = await generateText({
    model,
    messages,
    output: Output.object({
      schema: ExtractionProposalSchema,
    }),
  });

  const proposal = parseExtractionProposal(result.output);
  const rawResponse: Record<string, unknown> = {
    output: result.output,
    finishReason: result.finishReason,
    usage: result.usage,
    warnings: result.warnings,
  };

  return {
    proposal,
    rawResponse,
    meta,
    provider: providerFromModel(meta.model),
  };
}
