import { NextRequest, NextResponse } from "next/server";
import { checkOutToday, ensureUserByEmail } from "@/lib/server-data";
import { AuthError, requireSessionUser } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  try {
    const session = requireSessionUser(req);
    const user = await ensureUserByEmail(session.email, session.name);
    const record = await checkOutToday(user.id);

    if (!record) {
      return NextResponse.json(
        { message: "출근 기록이 없습니다." },
        { status: 400 },
      );
    }

    return NextResponse.json(record);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : "퇴근 처리 실패";
    return NextResponse.json({ message }, { status: 400 });
  }
}
