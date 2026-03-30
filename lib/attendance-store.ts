export interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  isOvernight: boolean;
}

export interface LeaveRecord {
  id: string;
  date: string;
  type: "annual" | "monthly";
  duration: 0.5 | 1;
  period?: "morning" | "afternoon";
  reason?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  annualLeaveRemaining: number;
  monthlyLeaveRemaining: number;
  workDays: number[];
  hireDate?: string;
  leaveBalanceInitialized?: boolean;
}

export const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5];

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function getKoreanDayName(date: Date): string {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return days[date.getDay()];
}

export function getKstNow(): Date {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + 9 * 60 * 60000);
}

export function toId(value: unknown): string {
  return String(value);
}
