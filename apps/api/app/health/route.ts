import { NextResponse } from "next/server";
import { getDbStatus } from "@selecta/db";
import { getGraphStatus } from "@selecta/graph";

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
 * Dual-DB health probe for local/prod sanity.
 * Returns 503 when either store is missing or unreachable.
 */
export async function GET() {
  const [dbStatus, graphStatus] = await Promise.all([getDbStatus(), getGraphStatus()]);
  const postgres = toProbe(dbStatus);
  const neo4j = toProbe(graphStatus);
  const ok = postgres.ok && neo4j.ok;

  return NextResponse.json(
    {
      ok,
      service: "api",
      postgres,
      neo4j,
    },
    { status: ok ? 200 : 503 },
  );
}
