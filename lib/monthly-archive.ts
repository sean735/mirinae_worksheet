import fs from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";
import { getDb } from "@/lib/mongodb";

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

const BASE_DIR =
  process.env.ATTENDANCE_ARCHIVE_DIR ||
  path.join(process.cwd(), "data", "attendance");

function getYearDir(yearMonth: string) {
  const [year] = yearMonth.split("-");
  return path.join(BASE_DIR, year);
}

function getWorkbookPath(yearMonth: string) {
  return path.join(getYearDir(yearMonth), `attendance_${yearMonth}.xlsx`);
}

function parseTimeToMinutes(value: string | null): number | null {
  if (!value) return null;
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

function computeWorkDuration(
  checkIn: string | null,
  checkOut: string | null,
): string {
  const inMinutes = parseTimeToMinutes(checkIn);
  const outMinutes = parseTimeToMinutes(checkOut);
  if (inMinutes === null || outMinutes === null) return "";

  let diff = outMinutes - inMinutes;
  if (diff < 0) diff += 24 * 60;

  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

async function ensureMonthDir(yearMonth: string) {
  await fs.mkdir(getYearDir(yearMonth), { recursive: true });
}

async function fetchMonthlyData(yearMonth: string) {
  const db = await getDb();
  const users = await db.collection<UserDoc>("users").find({}).toArray();
  const attendance = await db
    .collection<AttendanceDoc>("attendance_records")
    .find({ date: { $regex: `^${yearMonth}-` } })
    .sort({ date: 1, userId: 1 })
    .toArray();

  const userById = new Map(users.map((user) => [user._id, user.name]));

  return { userById, attendance };
}

export async function writeMonthlyArchive(yearMonth: string) {
  await ensureMonthDir(yearMonth);

  const { userById, attendance } = await fetchMonthlyData(yearMonth);

  const attendanceRows = attendance.map((record) => ({
    이름: userById.get(record.userId) || record.userId,
    날짜: record.date,
    출근시각: record.checkIn || "",
    퇴근시각: record.checkOut || "",
    근무시간: computeWorkDuration(record.checkIn, record.checkOut),
    비고: record.isOvernight ? "철야" : record.remark || "",
  }));

  const attendanceSheet = XLSX.utils.json_to_sheet(attendanceRows, {
    header: ["이름", "날짜", "출근시각", "퇴근시각", "근무시간", "비고"],
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, attendanceSheet, "출퇴근 기록");

  XLSX.writeFile(workbook, getWorkbookPath(yearMonth));
}

export async function ensureMonthlyArchiveExists(yearMonth: string) {
  await ensureMonthDir(yearMonth);
  const filePath = getWorkbookPath(yearMonth);

  try {
    await fs.access(filePath);
    return;
  } catch {
    await writeMonthlyArchive(yearMonth);
  }
}

export function getPreviousMonth(yearMonth: string): string {
  const [yearText, monthText] = yearMonth.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const date = new Date(year, month - 2, 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function getYearMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
