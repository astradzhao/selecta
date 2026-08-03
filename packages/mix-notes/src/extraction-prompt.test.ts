import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_EXTRACTION_MODEL,
  EXTRACTION_PROMPT_EXAMPLES,
  EXTRACTION_PROMPT_VERSION,
  buildExtractionMessages,
  buildExtractionSystemPrompt,
  buildExtractionUserPrompt,
  getExtractionPromptMeta,
} from "./extraction-prompt";
import { parseExtractionProposal } from "./extraction-schema";

describe("extraction prompt", () => {
  it("exposes a stable prompt version and default model for note audit fields", () => {
    assert.equal(EXTRACTION_PROMPT_VERSION, "v1");
    assert.deepEqual(getExtractionPromptMeta(), {
      promptVersion: "v1",
      model: DEFAULT_EXTRACTION_MODEL,
    });
    assert.deepEqual(getExtractionPromptMeta("openai/gpt-4.1"), {
      promptVersion: "v1",
      model: "openai/gpt-4.1",
    });
  });

  it("instructs the model not to assume every note is a transition", () => {
    const system = buildExtractionSystemPrompt();
    assert.match(system, /Never assume every note is a transition/i);
    assert.match(system, /Prompt version: v1/);
    assert.match(system, /song_note/);
    assert.match(system, /unknown/);
  });

  it("embeds the raw note in the user prompt", () => {
    const note = "levels - avicii -> love someone - prospa bar 32 -> bar 40";
    assert.match(buildExtractionUserPrompt(`  ${note}  `), new RegExp(note));
    const messages = buildExtractionMessages(note);
    assert.equal(messages[0]?.role, "system");
    assert.equal(messages[1]?.role, "user");
    assert.match(messages[1]?.content ?? "", new RegExp(note));
  });

  it("covers DJ-32 example classes and validates expected proposals", () => {
    const ids = new Set(EXTRACTION_PROMPT_EXAMPLES.map((example) => example.id));
    assert.ok(ids.has("transition-bars"));
    assert.ok(ids.has("song-note-only"));
    assert.ok(ids.has("no-recognizable-song"));
    assert.ok(ids.has("partial-technique-intent"));

    for (const example of EXTRACTION_PROMPT_EXAMPLES) {
      const parsed = parseExtractionProposal(example.expected);
      assert.equal(parsed.noteType, example.expected.noteType);
      assert.match(buildExtractionSystemPrompt(), new RegExp(example.id));
    }

    const songOnly = EXTRACTION_PROMPT_EXAMPLES.find((e) => e.id === "song-note-only");
    assert.ok(songOnly);
    assert.equal(songOnly.expected.transitionProposals.length, 0);
    assert.ok(songOnly.expected.songMentions.length >= 1);

    const unknown = EXTRACTION_PROMPT_EXAMPLES.find((e) => e.id === "no-recognizable-song");
    assert.ok(unknown);
    assert.equal(unknown.expected.songMentions.length, 0);
    assert.equal(unknown.expected.transitionProposals.length, 0);
  });
});
