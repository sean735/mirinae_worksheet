import { NextRequest, NextResponse } from "next/server";
import { ensureUserByEmail, listMonthlyAttendance } from "@/lib/server-data";
import { AuthError, requireSessionUser } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const session = requireSessionUser(req);
    const user = await ensureUserByEmail(session.email, session.name);
    const records = await listMonthlyAttendance(user.id);
    return NextResponse.json(records);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    const message =
      error instanceof Error ? error.message : "월별 근태 조회 실패";
    return NextResponse.json({ message }, { status: 400 });
  }
}
