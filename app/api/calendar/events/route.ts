import { NextRequest, NextResponse } from "next/server";
import {
  CalendarIntegrationError,
  listCalendarEventsByMonth,
} from "@/lib/google-calendar";
import { getKstNow } from "@/lib/attendance-store";
import { AuthError, requireSessionUser } from "@/lib/api-auth";

function getDefaultYearMonth() {
  const now = getKstNow();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function GET(req: NextRequest) {
  const yearMonth =
    req.nextUrl.searchParams.get("month") || getDefaultYearMonth();

  try {
    requireSessionUser(req);
    const events = await listCalendarEventsByMonth(yearMonth);
    return NextResponse.json({ yearMonth, events });
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
      error instanceof Error ? error.message : "캘린더 조회에 실패했습니다";
    return NextResponse.json({ message }, { status: 400 });
  }
}
