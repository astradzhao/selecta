import { formatMixPoint } from "@selecta/library/mix-point";

export { formatMixPoint };

export function mixPointText(
  cue: string | null | undefined,
  bar: number | null | undefined,
): string {
  return formatMixPoint(cue, bar) ?? "—";
}

export function hasMixPoint(
  cue: string | null | undefined,
  bar: number | null | undefined,
): boolean {
  return formatMixPoint(cue, bar) != null;
}
