import { NextRequest, NextResponse } from "next/server";
import { ensureUserByEmail, getStatusSummary } from "@/lib/server-data";
import { AuthError, requireSessionUser } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const session = requireSessionUser(req);
    const user = await ensureUserByEmail(session.email, session.name);
    const summary = await getStatusSummary(user.id);
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : "현황 조회 실패";
    return NextResponse.json({ message }, { status: 400 });
  }
}
