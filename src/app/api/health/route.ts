import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { healthChecks } from "@/lib/db/schema";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: true, db: "skipped" as const });
  }

  try {
    const db = getDb();
    await db.select().from(healthChecks).limit(1);
    return NextResponse.json({ ok: true, db: "ok" as const });
  } catch (error) {
    const message = error instanceof Error ? error.message : "database error";
    return NextResponse.json({ ok: false, db: "error" as const, message }, { status: 503 });
  }
}
