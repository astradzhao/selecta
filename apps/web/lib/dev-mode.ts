/** Mirror of API/agentics DEV_MODE gate for server components. */
export function isDevMode(): boolean {
  const value = process.env.DEV_MODE?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}
