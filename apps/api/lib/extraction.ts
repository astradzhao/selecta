import { completeExtraction, failExtraction, getNoteById, isPostgresConfigured } from "@selecta/db";
import { extractNoteProposals, hasTransitionProposals } from "@selecta/mix-notes";

/**
 * Run extraction for a note version and persist the result.
 * No-ops when the note was edited (version mismatch) or is no longer extracting.
 * Never throws to the caller — failures are written onto the note row.
 */
export async function runNoteExtraction(noteId: string, version: number): Promise<void> {
  if (!isPostgresConfigured()) {
    return;
  }

  const note = await getNoteById(noteId);
  if (!note) {
    return;
  }
  if (note.extractionVersion !== version || note.extractionStatus !== "extracting") {
    return;
  }

  if (!process.env.AI_GATEWAY_API_KEY?.trim()) {
    await failExtraction(
      noteId,
      version,
      "AI_GATEWAY_API_KEY is not configured. Extraction cannot run.",
    );
    return;
  }

  try {
    const result = await extractNoteProposals({ rawText: note.rawText });
    const resolving = hasTransitionProposals(result.proposal);

    await completeExtraction(noteId, version, {
      extraction: result.proposal as unknown as Record<string, unknown>,
      rawResponse: result.rawResponse,
      model: result.meta.model,
      provider: result.provider,
      promptVersion: result.meta.promptVersion,
      extractionConfidence: result.proposal.confidence,
      extractionStatus: resolving ? "resolving" : "no_proposal",
      status: resolving ? "preview" : "draft",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Note extraction failed unexpectedly.";
    console.error(`note extraction failed for ${noteId}@${version}`, error);
    await failExtraction(noteId, version, message);
  }
}
