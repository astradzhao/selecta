import { NextResponse } from "next/server";
import { getDbStatus } from "@selecta/db";
import { getGraphStatus } from "@selecta/graph";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "api",
    db: await getDbStatus(),
    graph: getGraphStatus(),
  });
}
