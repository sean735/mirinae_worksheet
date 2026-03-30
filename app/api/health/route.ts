import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      services: { mongodb: "ok" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        services: { mongodb: "error" },
        message,
      },
      { status: 503 },
    );
  }
}
