import { NextRequest, NextResponse } from "next/server";
import {
  ensureUserByEmail,
  updateUserLeaveBalance,
  updateUserWorkDays,
} from "@/lib/server-data";
import { AuthError, requireSessionUser } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const session = requireSessionUser(req);
    const user = await ensureUserByEmail(session.email, session.name);
    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : "사용자 조회 실패";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = requireSessionUser(req);
    const user = await ensureUserByEmail(session.email, session.name);
    const body = (await req.json()) as {
      workDays?: number[];
      annualLeaveRemaining?: number;
      monthlyLeaveRemaining?: number;
      hireDate?: string;
    };

    if (Array.isArray(body.workDays)) {
      const updated = await updateUserWorkDays(user.id, body.workDays);
      return NextResponse.json(updated);
    }

    if (
      typeof body.annualLeaveRemaining === "number" &&
      typeof body.monthlyLeaveRemaining === "number"
    ) {
      const updated = await updateUserLeaveBalance(user.id, {
        annualLeaveRemaining: body.annualLeaveRemaining,
        monthlyLeaveRemaining: body.monthlyLeaveRemaining,
        hireDate: body.hireDate,
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json(
      {
        message:
          "workDays 배열 또는 annualLeaveRemaining/monthlyLeaveRemaining 값이 필요합니다",
      },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    const message =
      error instanceof Error ? error.message : "사용자 업데이트 실패";
    return NextResponse.json({ message }, { status: 400 });
  }
}
