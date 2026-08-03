import { NextResponse } from "next/server";
import { getDbStatus } from "@selecta/db";
import { getGraphStatus } from "@selecta/graph";

export async function GET() {
  const [db, graph] = await Promise.all([getDbStatus(), getGraphStatus()]);
  return NextResponse.json({
    ok: true,
    service: "api",
    db,
    graph,
  });
}
