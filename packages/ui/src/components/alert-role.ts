export type AlertVariant = "info" | "success" | "warning" | "destructive";

export function alertRole(variant: AlertVariant): "alert" | "status" {
  return variant === "destructive" || variant === "warning" ? "alert" : "status";
}
