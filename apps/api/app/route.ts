import { NextResponse } from "next/server";
import { getDbStatus } from "@selecta/db";

export async function GET() {
  const db = await getDbStatus();
  return NextResponse.json({
    ok: true,
    service: "api",
    db,
  });
}
