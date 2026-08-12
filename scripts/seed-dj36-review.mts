/**
 * One-shot local seed for DJ-36 review UI dogfood.
 * Creates tracks, a partially-committed submission, committed transitions,
 * and needs_review proposals with candidate lists.
 *
 * Usage from repo root:
 *   packages/db/node_modules/.bin/tsx scripts/seed-dj36-review.mts
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { loadRootEnv } from "./load-root-env.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadRootEnv(repoRoot);

const {
  claimProposal,
  completeExtraction,
  commitTransitionProposal,
  createNote,
  createTrack,
  createTransition,
  isPostgresConfigured,
  refreshSubmissionExtractionStatus,
  updateProposal,
} = await import("../packages/db/src/index.ts");
const { sourceFingerprint, spanProposalKey } =
  await import("../packages/mix-notes/src/agent/proposal-key.ts");

if (!isPostgresConfigured()) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local first.");
  process.exit(1);
}

function candidate(
  handle: string,
  title: string,
  artists: string[],
  extras: Record<string, unknown> = {},
) {
  return { handle, title, artists, durationMs: 210000, artworkUrl: null, ...extras };
}

async function main() {
  const trackA = await createTrack({
    title: "Destination",
    artists: ["Nickel Creek"],
    subgenres: [{ name: "House" }, { name: "Tech House" }],
    bpm: 124,
    musicalKey: "Am",
  });
  const trackB = await createTrack({
    title: "Latch",
    artists: ["Disclosure", "Sam Smith"],
    subgenres: [{ name: "UKG" }],
    bpm: 122,
  });
  const trackC = await createTrack({
    title: "Cola",
    artists: ["CamelPhat", "Elderbrook"],
    subgenres: [{ name: "Tech House" }],
    bpm: 123,
  });
  const trackD = await createTrack({
    title: "Obvs",
    artists: ["Jamie xx"],
    subgenres: [{ name: "UKG" }],
    bpm: 120,
  });

  const rawText = [
    "Set notes — Fri warm-up",
    "",
    "Destination → Latch @ bar 64 with a long blend, energy up.",
    "Cola into something like 'midnight city' (M83?) — not sure which remaster.",
    "Obvs works into an unknown UKG cut I still need to ID.",
  ].join("\n");

  const note = await createNote({ rawText });
  const version = note.extractionVersion;

  // --- Proposal 1: clear, auto-committed ---
  const span1 = "Destination → Latch @ bar 64 with a long blend, energy up.";
  const start1 = rawText.indexOf(span1);
  const end1 = start1 + span1.length;
  const fp1 = sourceFingerprint(start1, end1, span1);
  const key1 = spanProposalKey(note.id, version, fp1);
  const claim1 = await claimProposal({
    noteId: note.id,
    extractionVersion: version,
    sourceStart: start1,
    sourceEnd: end1,
    sourceText: span1,
    sourceFingerprint: fp1,
    proposalKey: key1,
  });
  const draft1 = {
    noteType: "transition",
    mentions: [
      {
        mentionId: "m1",
        mention: "Destination",
        titleHint: "Destination",
        artistHint: "Nickel Creek",
        confidence: 0.9,
        ambiguityReason: null,
      },
      {
        mentionId: "m2",
        mention: "Latch",
        titleHint: "Latch",
        artistHint: "Disclosure",
        confidence: 0.9,
        ambiguityReason: null,
      },
    ],
    transition: {
      fromMentionId: "m1",
      toMentionId: "m2",
      fromBar: 64,
      toBar: 1,
      barsOverlap: 16,
      technique: "blend",
      intent: "energy up",
      quality: "great",
      notes: null,
    },
    bidirectional: false,
    confidence: "strong",
    ambiguities: [],
  };
  const commit1 = await commitTransitionProposal({
    fromTrackId: trackA.track.id,
    toTrackId: trackB.track.id,
    proposalKey: key1,
    sourceNoteId: note.id,
    sourceNoteVersion: version,
    sourceProposalId: claim1.proposal.id,
    confidence: 0.8,
    fromBar: 64,
    toBar: 1,
    barsOverlap: 16,
    technique: "blend",
    intent: "energy up",
    quality: "great",
  });
  await updateProposal(claim1.proposal.id, {
    status: "committed",
    draft: draft1,
    resolution: {
      plan: {
        ...draft1,
        mentions: [
          {
            ...draft1.mentions[0],
            selectedCandidateId: `graph:${trackA.track.id}`,
            resolutionStatus: "resolved",
          },
          {
            ...draft1.mentions[1],
            selectedCandidateId: `graph:${trackB.track.id}`,
            resolutionStatus: "resolved",
          },
        ],
      },
      candidates: {
        m1: [
          candidate(`graph:${trackA.track.id}`, "Destination", ["Nickel Creek"], {
            trackId: trackA.track.id,
            provider: "library",
          }),
        ],
        m2: [
          candidate(`graph:${trackB.track.id}`, "Latch", ["Disclosure", "Sam Smith"], {
            trackId: trackB.track.id,
            provider: "library",
          }),
        ],
      },
    },
    policyResult: {
      decision: "auto_commit",
      reasons: [{ code: "ok", message: "Proposal auto-commit gates passed." }],
      reviewReasons: [],
      applied: {
        committed: true,
        fromTrackId: trackA.track.id,
        toTrackId: trackB.track.id,
        transitionId: commit1.id,
      },
    },
  });

  // --- Proposal 2: ambiguous Midnight City → needs_review ---
  const span2 = "Cola into something like 'midnight city' (M83?) — not sure which remaster.";
  const start2 = rawText.indexOf(span2);
  const end2 = start2 + span2.length;
  const fp2 = sourceFingerprint(start2, end2, span2);
  const key2 = spanProposalKey(note.id, version, fp2);
  const claim2 = await claimProposal({
    noteId: note.id,
    extractionVersion: version,
    sourceStart: start2,
    sourceEnd: end2,
    sourceText: span2,
    sourceFingerprint: fp2,
    proposalKey: key2,
  });
  const draft2 = {
    noteType: "transition",
    mentions: [
      {
        mentionId: "m1",
        mention: "Cola",
        titleHint: "Cola",
        artistHint: "CamelPhat",
        confidence: 0.85,
        ambiguityReason: null,
      },
      {
        mentionId: "m2",
        mention: "midnight city",
        titleHint: "Midnight City",
        artistHint: "M83",
        confidence: 0.4,
        ambiguityReason: "Multiple remasters / versions",
      },
    ],
    transition: {
      fromMentionId: "m1",
      toMentionId: "m2",
      fromBar: 32,
      toBar: 1,
      barsOverlap: 8,
      technique: "cut",
      intent: "mood shift",
      quality: "ok",
      notes: "Which Midnight City?",
    },
    bidirectional: false,
    confidence: "moderate",
    ambiguities: ["Unclear which Midnight City remaster"],
  };
  await updateProposal(claim2.proposal.id, {
    status: "needs_review",
    draft: draft2,
    resolution: {
      plan: {
        ...draft2,
        mentions: [
          {
            ...draft2.mentions[0],
            selectedCandidateId: `graph:${trackC.track.id}`,
            resolutionStatus: "resolved",
          },
          {
            ...draft2.mentions[1],
            selectedCandidateId: "spotify:seed-midnight-city-original",
            resolutionStatus: "catalog_match",
          },
        ],
      },
      candidates: {
        m1: [
          candidate(`graph:${trackC.track.id}`, "Cola", ["CamelPhat", "Elderbrook"], {
            trackId: trackC.track.id,
            provider: "library",
          }),
        ],
        m2: [
          candidate("spotify:seed-midnight-city-original", "Midnight City", ["M83"], {
            provider: "spotify",
            providerId: "seed-midnight-city-original",
          }),
          candidate("spotify:seed-midnight-city-radio", "Midnight City - Radio Edit", ["M83"], {
            provider: "spotify",
            providerId: "seed-midnight-city-radio",
          }),
          candidate("spotify:seed-midnight-city-live", "Midnight City - Live", ["M83"], {
            provider: "spotify",
            providerId: "seed-midnight-city-live",
          }),
        ],
      },
    },
    policyResult: {
      decision: "needs_review",
      reasons: [
        {
          code: "low_confidence",
          message: 'Overall confidence "moderate" below auto-commit floor "strong".',
        },
      ],
      reviewReasons: [
        {
          code: "low_confidence",
          message: 'Overall confidence "moderate" below auto-commit floor "strong".',
        },
      ],
      imports: [],
      commit: null,
      resolvedTrackIdsByMention: { m1: trackC.track.id },
    },
  });

  // --- Proposal 3: unresolved endpoint → needs_review ---
  const span3 = "Obvs works into an unknown UKG cut I still need to ID.";
  const start3 = rawText.indexOf(span3);
  const end3 = start3 + span3.length;
  const fp3 = sourceFingerprint(start3, end3, span3);
  const key3 = spanProposalKey(note.id, version, fp3);
  const claim3 = await claimProposal({
    noteId: note.id,
    extractionVersion: version,
    sourceStart: start3,
    sourceEnd: end3,
    sourceText: span3,
    sourceFingerprint: fp3,
    proposalKey: key3,
  });
  const draft3 = {
    noteType: "transition",
    mentions: [
      {
        mentionId: "m1",
        mention: "Obvs",
        titleHint: "Obvs",
        artistHint: "Jamie xx",
        confidence: 0.8,
        ambiguityReason: null,
      },
      {
        mentionId: "m2",
        mention: "unknown UKG cut",
        titleHint: null,
        artistHint: null,
        confidence: 0.1,
        ambiguityReason: "No identifiable title",
      },
    ],
    transition: {
      fromMentionId: "m1",
      toMentionId: "m2",
      fromBar: null,
      toBar: null,
      barsOverlap: null,
      technique: null,
      intent: null,
      quality: "ok",
      notes: "Need to ID the UKG cut",
    },
    bidirectional: false,
    confidence: "low",
    ambiguities: ["To-track unresolved"],
  };
  await updateProposal(claim3.proposal.id, {
    status: "needs_review",
    draft: draft3,
    resolution: {
      plan: {
        ...draft3,
        mentions: [
          {
            ...draft3.mentions[0],
            selectedCandidateId: `graph:${trackD.track.id}`,
            resolutionStatus: "resolved",
          },
          {
            ...draft3.mentions[1],
            selectedCandidateId: null,
            resolutionStatus: "unresolved",
          },
        ],
      },
      candidates: {
        m1: [
          candidate(`graph:${trackD.track.id}`, "Obvs", ["Jamie xx"], {
            trackId: trackD.track.id,
            provider: "library",
          }),
        ],
        m2: [],
      },
    },
    policyResult: {
      decision: "needs_review",
      reasons: [
        {
          code: "low_confidence",
          message: 'Overall confidence "low" below auto-commit floor "strong".',
        },
        {
          code: "unresolved_endpoint",
          message: "toMentionId=m2 is unresolved.",
        },
      ],
      reviewReasons: [
        {
          code: "low_confidence",
          message: 'Overall confidence "low" below auto-commit floor "strong".',
        },
        {
          code: "unresolved_endpoint",
          message: "toMentionId=m2 is unresolved.",
        },
      ],
      imports: [],
      commit: null,
      resolvedTrackIdsByMention: { m1: trackD.track.id },
    },
  });

  // Extra manual transition so Transitions tab isn't empty of committed edges.
  await createTransition({
    fromTrackId: trackB.track.id,
    toTrackId: trackC.track.id,
    technique: "cut",
    intent: "reset",
    quality: "ok",
    fromBar: 48,
    toBar: 1,
    barsOverlap: 4,
  });

  await completeExtraction(note.id, version, {
    extraction: {
      pipeline: "seed-dj36-review",
      counts: { committed: 1, needs_review: 2, failed: 0, rejected: 0, total: 3 },
      applySummary: { committed: 1, needsReview: 2, failed: 0, proposalCount: 3 },
      proposals: [
        { id: claim1.proposal.id, status: "committed", sourceText: span1 },
        { id: claim2.proposal.id, status: "needs_review", sourceText: span2 },
        { id: claim3.proposal.id, status: "needs_review", sourceText: span3 },
      ],
    },
    rawResponse: { seed: true },
    model: "seed/local",
    provider: "seed",
    promptVersion: "seed-dj36",
    extractionConfidence: 0.55,
    extractionStatus: "partially_committed",
  });

  await refreshSubmissionExtractionStatus(note.id, version);

  console.log(
    JSON.stringify(
      {
        ok: true,
        submissionId: note.id,
        reviewUrls: [
          `/library/submissions/${note.id}/proposals/${claim2.proposal.id}`,
          `/library/submissions/${note.id}/proposals/${claim3.proposal.id}`,
        ],
        tracks: [trackA, trackB, trackC, trackD].map((t) => ({
          id: t.track.id,
          title: t.track.title,
        })),
        committedTransitionId: commit1.id,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
