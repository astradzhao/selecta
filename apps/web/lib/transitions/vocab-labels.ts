import {
  TRANSITION_INTENTS,
  TRANSITION_QUALITIES,
  TRANSITION_TECHNIQUES,
} from "@selecta/library/constants";

export type VocabOption = {
  value: string;
  label: string;
};

const TECHNIQUE_LABELS: Record<(typeof TRANSITION_TECHNIQUES)[number], string> = {
  high_pass_filter: "High-pass filter",
  low_pass_filter: "Low-pass filter",
  bass_swap: "Bass swap",
  loop: "Loop",
  "4_bar_loop": "4-bar loop",
  echo_out: "Echo out",
  cut: "Cut",
  blend: "Blend",
};

const INTENT_LABELS: Record<(typeof TRANSITION_INTENTS)[number], string> = {
  build_hype: "Build hype",
  cool_down: "Cool down",
  maintain_energy: "Maintain energy",
  peak_time: "Peak time",
  mix_in: "Mix in",
  mix_out: "Mix out",
};

const QUALITY_LABELS: Record<(typeof TRANSITION_QUALITIES)[number], string> = {
  great: "Great",
  ok: "OK",
  risky: "Risky",
};

export const TECHNIQUE_OPTIONS: VocabOption[] = TRANSITION_TECHNIQUES.map((value) => ({
  value,
  label: TECHNIQUE_LABELS[value],
}));

export const INTENT_OPTIONS: VocabOption[] = TRANSITION_INTENTS.map((value) => ({
  value,
  label: INTENT_LABELS[value],
}));

export const QUALITY_OPTIONS: VocabOption[] = TRANSITION_QUALITIES.map((value) => ({
  value,
  label: QUALITY_LABELS[value],
}));

const LABEL_BY_TOKEN = new Map<string, string>(
  [...TECHNIQUE_OPTIONS, ...INTENT_OPTIONS, ...QUALITY_OPTIONS].map((option) => [
    option.value,
    option.label,
  ]),
);

/** Human label for a stored token; unknown values render as typed. */
export function vocabLabel(token: string): string {
  return LABEL_BY_TOKEN.get(token) ?? token;
}

export function filterVocabOptions(query: string, options: readonly VocabOption[]): VocabOption[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...options];
  return options.filter(
    (option) =>
      option.label.toLowerCase().includes(needle) || option.value.toLowerCase().includes(needle),
  );
}

/**
 * Map a typed string to a stored value: exact label or token → token, otherwise the trimmed
 * free text. Empty / whitespace becomes `""`.
 */
export function commitVocabValue(raw: string, options: readonly VocabOption[]): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  const match = options.find(
    (option) => option.label.toLowerCase() === lower || option.value.toLowerCase() === lower,
  );
  return match?.value ?? trimmed;
}
