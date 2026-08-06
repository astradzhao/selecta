import type { TransitionRecord } from "@selecta/graph";

/** API shape for a committed TRANSITION with endpoint summaries. */
export function serializeTransition(record: TransitionRecord) {
  return {
    id: record.id,
    fromTrack: {
      id: record.from.track.id,
      title: record.from.track.title,
    },
    toTrack: {
      id: record.to.track.id,
      title: record.to.track.title,
    },
    proposalKey: record.edge.proposalKey,
    sourceNoteId: record.edge.sourceNoteId,
    sourceNoteVersion: record.edge.sourceNoteVersion,
    sourceProposalId: record.edge.sourceProposalId,
    confidence: record.edge.confidence,
    fromBar: record.edge.fromBar,
    toBar: record.edge.toBar,
    barsOverlap: record.edge.barsOverlap,
    technique: record.edge.technique,
    intent: record.edge.intent,
    quality: record.edge.quality,
    notes: record.edge.notes,
    createdAt: record.edge.createdAt,
    updatedAt: record.edge.updatedAt,
  };
}
