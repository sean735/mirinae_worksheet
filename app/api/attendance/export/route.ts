import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { AuthError, requireSessionUser } from "@/lib/api-auth";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

type AttendanceDoc = {
  userId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  isOvernight: boolean;
  remark?: string;
};

type LeaveDoc = {
  userId: string;
  date: string;
  type: "annual" | "monthly";
  duration: 0.5 | 1;
  period?: "morning" | "afternoon";
  reason?: string;
  createdAt: Date;
};

type UserDoc = {
  _id: string;
  name: string;
  annualLeaveRemaining: number;
  monthlyLeaveRemaining: number;
  workDays?: number[];
};

export async function GET(req: NextRequest) {
  try {
    requireSessionUser(req);

    const db = await getDb();
    const users = await db.collection<UserDoc>("users").find({}).toArray();
    const attendance = await db
      .collection<AttendanceDoc>("attendance_records")
      .find({})
      .sort({ date: 1, userId: 1 })
      .toArray();
    const leaves = await db
      .collection<LeaveDoc>("leave_records")
      .find({})
      .sort({ date: 1, userId: 1 })
      .toArray();

    const userById = new Map(users.map((user) => [user._id, user.name]));

    // Sheet 1: Attendance
    const attendanceRows = attendance.map((record) => ({
      이름: userById.get(record.userId) || record.userId,
      날짜: record.date,
      출근시각: record.checkIn || "",
      퇴근시각: record.checkOut || "",
      근무시간: computeWorkDuration(record.checkIn, record.checkOut),
      비고: record.isOvernight ? "철야" : record.remark || "",
    }));

    // Sheet 2: Leave records
    const leaveRows = leaves.map((record) => ({
      이름: userById.get(record.userId) || record.userId,
      날짜: record.date,
      유형: record.type === "annual" ? "연차" : "월차",
      일수: record.duration,
      시간대:
        record.duration === 0.5
          ? record.period === "morning"
            ? "오전"
            : "오후"
          : "종일",
      사유: record.reason || "",
    }));

    // Sheet 3: Leave balance summary
    const balanceRows = users.map((user) => {
      const userLeaves = leaves.filter((l) => l.userId === user._id);
      const usedAnnual = userLeaves
        .filter((l) => l.type === "annual")
        .reduce((sum, l) => sum + l.duration, 0);
      const usedMonthly = userLeaves
        .filter((l) => l.type === "monthly")
        .reduce((sum, l) => sum + l.duration, 0);

      return {
        이름: user.name,
        "근무일수(주)": (user.workDays || [1, 2, 3, 4, 5]).length,
        "연차 잔여": user.annualLeaveRemaining,
        "연차 사용": usedAnnual,
        "연차 합계": user.annualLeaveRemaining + usedAnnual,
        "월차 잔여": user.monthlyLeaveRemaining,
        "월차 사용": usedMonthly,
        "월차 합계": user.monthlyLeaveRemaining + usedMonthly,
      };
    });

    const workbook = XLSX.utils.book_new();

    const attendanceSheet = XLSX.utils.json_to_sheet(attendanceRows, {
      header: ["이름", "날짜", "출근시각", "퇴근시각", "근무시간", "비고"],
    });
    XLSX.utils.book_append_sheet(workbook, attendanceSheet, "출퇴근기록");

    const leaveSheet = XLSX.utils.json_to_sheet(leaveRows, {
      header: ["이름", "날짜", "유형", "일수", "시간대", "사유"],
    });
    XLSX.utils.book_append_sheet(workbook, leaveSheet, "연차월차 사용내역");

    const balanceSheet = XLSX.utils.json_to_sheet(balanceRows, {
      header: [
        "이름",
        "근무일수(주)",
        "연차 잔여",
        "연차 사용",
        "연차 합계",
        "월차 잔여",
        "월차 사용",
        "월차 합계",
      ],
    });
    XLSX.utils.book_append_sheet(workbook, balanceSheet, "잔여현황");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="attendance_${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json({ message: "엑셀 생성 실패" }, { status: 500 });
  }
}

function computeWorkDuration(
  checkIn: string | null,
  checkOut: string | null,
): string {
  if (!checkIn || !checkOut) return "";
  const [inH, inM] = checkIn.split(":").map(Number);
  const [outH, outM] = checkOut.split(":").map(Number);
  let mins = (outH - inH) * 60 + (outM - inM);
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}시간 ${m}분`;
}
