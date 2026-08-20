export type StatusTone = "success" | "warning" | "info" | "destructive" | "neutral";

export type StatusDisplay = {
  label: string;
  tone: StatusTone;
  inProgress?: boolean;
};

export type StatusBadgeVariant = "success" | "warning" | "info" | "destructive" | "secondary";

export function toneToBadgeVariant(tone: StatusTone): StatusBadgeVariant {
  if (tone === "neutral") return "secondary";
  return tone;
}
