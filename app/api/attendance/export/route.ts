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

type UserDoc = {
  _id: string;
  name: string;
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

    const userById = new Map(users.map((user) => [user._id, user.name]));
    const rows = attendance.map((record) => ({
      이름: userById.get(record.userId) || record.userId,
      날짜: record.date,
      출근시각: record.checkIn || "",
      퇴근시각: record.checkOut || "",
      근무시간: computeWorkDuration(record.checkIn, record.checkOut),
      비고: record.isOvernight ? "철야" : record.remark || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ["이름", "날짜", "출근시각", "퇴근시각", "근무시간", "비고"],
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "출퇴근기록");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="attendance_all_${new Date()
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
