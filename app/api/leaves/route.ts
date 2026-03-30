import { NextRequest, NextResponse } from "next/server";
import { createLeave, ensureUserByEmail, listLeaves } from "@/lib/server-data";
import type { LeaveRecord } from "@/lib/attendance-store";
import { CalendarIntegrationError } from "@/lib/google-calendar";
import { AuthError, requireSessionUser } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const session = requireSessionUser(req);
    const user = await ensureUserByEmail(session.email, session.name);
    const records = await listLeaves(user.id);
    return NextResponse.json(records);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    const message =
      error instanceof Error ? error.message : "휴가 조회에 실패했습니다";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireSessionUser(req);
    const user = await ensureUserByEmail(session.email, session.name);
    const payload = (await req.json()) as Omit<LeaveRecord, "id">;
    const result = await createLeave(user.id, payload);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    if (error instanceof CalendarIntegrationError) {
      return NextResponse.json(
        {
          message: error.message,
          code: error.code,
          action: error.action,
          retryable: error.retryable,
          details: error.details,
        },
        { status: error.status || 502 },
      );
    }

    const message =
      error instanceof Error ? error.message : "휴가 등록에 실패했습니다";
    return NextResponse.json({ message }, { status: 400 });
  }
}
