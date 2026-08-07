import { NextResponse } from "next/server";
import { getDbStatus } from "@selecta/db";

type DbProbe = {
  ok: boolean;
  configured: boolean;
  latencyMs?: number;
  error?: string;
};

function toProbe(status: {
  configured: boolean;
  ok?: boolean;
  latencyMs?: number;
  error?: string;
}): DbProbe {
  if (!status.configured) {
    return { ok: false, configured: false, error: "not configured" };
  }
  return {
    ok: status.ok === true,
    configured: true,
    latencyMs: status.latencyMs,
    ...(status.error ? { error: status.error } : {}),
  };
}

/**
 * Postgres health probe for local/prod sanity.
 * Returns 503 when the store is missing or unreachable.
 */
export async function GET() {
  const dbStatus = await getDbStatus();
  const postgres = toProbe(dbStatus);
  const ok = postgres.ok;

  return NextResponse.json(
    {
      ok,
      service: "api",
      postgres,
    },
    { status: ok ? 200 : 503 },
  );
}
