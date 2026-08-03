import { NextResponse } from "next/server";
import { getDbStatus } from "@dj/db";
import { getGraphStatus } from "@dj/graph";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "api",
    db: getDbStatus(),
    graph: getGraphStatus(),
  });
}
