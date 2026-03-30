import { NextRequest, NextResponse } from "next/server";
import { deleteLeave, ensureUserByEmail } from "@/lib/server-data";
import { CalendarIntegrationError } from "@/lib/google-calendar";
import { AuthError, requireSessionUser } from "@/lib/api-auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return NextResponse.json(
      { message: "유효하지 않은 휴가 ID입니다" },
      { status: 400 },
    );
  }

  try {
    const session = requireSessionUser(req);
    const userInfo = await ensureUserByEmail(session.email, session.name);
    const user = await deleteLeave(userInfo.id, id);
    return NextResponse.json(user);
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
      error instanceof Error ? error.message : "휴가 삭제에 실패했습니다";
    return NextResponse.json({ message }, { status: 400 });
  }
}
