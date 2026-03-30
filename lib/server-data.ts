import { ObjectId, type Collection } from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
  DEFAULT_WORK_DAYS,
  formatDate,
  formatTime,
  getKstNow,
  toId,
  type AttendanceRecord,
  type LeaveRecord,
  type User,
} from "@/lib/attendance-store";
import { writeMonthlyArchive } from "@/lib/monthly-archive";
import {
  createLeaveCalendarEvent,
  deleteCalendarEventById,
} from "@/lib/google-calendar";

export const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || "demo-user";

type DbAttendanceRecord = {
  _id?: ObjectId;
  userId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  isOvernight: boolean;
  remark?: string;
  calendarEventId?: string;
  createdAt: Date;
  updatedAt: Date;
};

type DbLeaveRecord = {
  _id?: ObjectId;
  userId: string;
  date: string;
  type: "annual" | "monthly";
  duration: 0.5 | 1;
  period?: "morning" | "afternoon";
  reason?: string;
  calendarEventId?: string;
  createdAt: Date;
  updatedAt: Date;
};

type DbUser = {
  _id: string;
  name: string;
  email: string;
  annualLeaveRemaining: number;
  monthlyLeaveRemaining: number;
  workDays?: number[];
  hireDate?: string;
  leaveBalanceInitialized?: boolean;
  monthlyLeaveLastGrantedAt?: string;
  annualLeaveLastGrantedAt?: string;
};

function toYearMonth(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function toYear(date: Date) {
  return String(date.getFullYear());
}

function shiftMonth(date: Date, offset: number) {
  const shifted = new Date(date);
  shifted.setMonth(shifted.getMonth() + offset);
  return shifted;
}

function getDueMonthlyGrantKey(baseDate: Date, hireDay: number) {
  const lastDayOfThisMonth = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth() + 1,
    0,
  ).getDate();
  const effectiveHireDay = Math.min(hireDay, lastDayOfThisMonth);

  if (baseDate.getDate() >= effectiveHireDay) {
    return toYearMonth(baseDate);
  }
  return toYearMonth(shiftMonth(baseDate, -1));
}

function getDueAnnualGrantKey(baseDate: Date, hireDate: Date) {
  const anniversaryMonth = hireDate.getMonth();
  const thisYearAnniversaryDay = Math.min(
    hireDate.getDate(),
    new Date(baseDate.getFullYear(), anniversaryMonth + 1, 0).getDate(),
  );

  const hasPassedAnniversary =
    baseDate.getMonth() > anniversaryMonth ||
    (baseDate.getMonth() === anniversaryMonth &&
      baseDate.getDate() >= thisYearAnniversaryDay);

  return hasPassedAnniversary
    ? toYear(baseDate)
    : String(baseDate.getFullYear() - 1);
}

function monthKeyToIndex(key: string) {
  const [yearText, monthText] = key.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  return year * 12 + (month - 1);
}

function monthDiff(fromKey: string, toKey: string) {
  return monthKeyToIndex(toKey) - monthKeyToIndex(fromKey);
}

function yearDiff(fromKey: string, toKey: string) {
  return Number(toKey) - Number(fromKey);
}

async function applyLeaveAccrualIfNeeded(
  users: Collection<DbUser>,
  user: DbUser,
): Promise<DbUser> {
  if (!user.leaveBalanceInitialized || !user.hireDate) {
    return user;
  }

  const hireDate = new Date(`${user.hireDate}T00:00:00`);
  if (Number.isNaN(hireDate.getTime())) {
    return user;
  }

  const now = getKstNow();
  const dueMonthlyKey = getDueMonthlyGrantKey(now, hireDate.getDate());
  const dueAnnualKey = getDueAnnualGrantKey(now, hireDate);

  const lastMonthlyKey = user.monthlyLeaveLastGrantedAt || dueMonthlyKey;
  const lastAnnualKey = user.annualLeaveLastGrantedAt || dueAnnualKey;

  const monthlyToGrant = Math.max(0, monthDiff(lastMonthlyKey, dueMonthlyKey));
  const annualToGrant = Math.max(0, yearDiff(lastAnnualKey, dueAnnualKey));

  const shouldOnlyBackfillKeys =
    !user.monthlyLeaveLastGrantedAt || !user.annualLeaveLastGrantedAt;

  if (monthlyToGrant === 0 && annualToGrant === 0 && !shouldOnlyBackfillKeys) {
    return user;
  }

  const updated = await users.findOneAndUpdate(
    { _id: user._id },
    {
      ...(monthlyToGrant > 0 || annualToGrant > 0
        ? {
            $inc: {
              monthlyLeaveRemaining: monthlyToGrant,
              annualLeaveRemaining: annualToGrant,
            },
          }
        : {}),
      $set: {
        monthlyLeaveLastGrantedAt: dueMonthlyKey,
        annualLeaveLastGrantedAt: dueAnnualKey,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );

  return updated || user;
}

function toUser(doc: DbUser): User {
  const workDays =
    doc.workDays && doc.workDays.length > 0 ? doc.workDays : DEFAULT_WORK_DAYS;

  return {
    id: doc._id,
    name: doc.name,
    email: doc.email,
    annualLeaveRemaining: doc.annualLeaveRemaining,
    monthlyLeaveRemaining: doc.monthlyLeaveRemaining,
    workDays,
    hireDate: doc.hireDate,
    leaveBalanceInitialized: doc.leaveBalanceInitialized ?? false,
  };
}

export async function ensureDefaultUser(): Promise<User> {
  const db = await getDb();
  const users = db.collection<DbUser>("users");

  const existing = await users.findOne({ _id: DEFAULT_USER_ID });
  if (existing) {
    return toUser(existing);
  }

  const user: DbUser = {
    _id: DEFAULT_USER_ID,
    name: "홍길동",
    email: "hong@company.com",
    annualLeaveRemaining: 12,
    monthlyLeaveRemaining: 3,
    workDays: DEFAULT_WORK_DAYS,
    leaveBalanceInitialized: false,
  };

  await users.insertOne(user);
  return toUser(user);
}

export async function ensureUserByEmail(
  email: string,
  name?: string,
): Promise<User> {
  const db = await getDb();
  const users = db.collection<DbUser>("users");

  const existing = await users.findOne({ _id: email });
  if (existing) {
    let current = existing;

    if (name && existing.name !== name) {
      const updated = await users.findOneAndUpdate(
        { _id: email },
        { $set: { name, updatedAt: new Date() } },
        { returnDocument: "after" },
      );
      if (updated) {
        current = updated;
      }
    }

    const accrued = await applyLeaveAccrualIfNeeded(users, current);
    return toUser(accrued);
  }

  const user: DbUser = {
    _id: email,
    name: name || email.split("@")[0],
    email,
    annualLeaveRemaining: 12,
    monthlyLeaveRemaining: 3,
    workDays: DEFAULT_WORK_DAYS,
    leaveBalanceInitialized: false,
  };

  await users.insertOne(user);
  return toUser(user);
}

export async function listMonthlyAttendance(
  userId: string,
): Promise<AttendanceRecord[]> {
  const db = await getDb();
  const yearMonth = formatDate(getKstNow()).slice(0, 7);

  const docs = await db
    .collection<DbAttendanceRecord>("attendance_records")
    .find({ userId, date: { $regex: `^${yearMonth}-` } })
    .sort({ date: -1, createdAt: -1 })
    .toArray();

  return docs.map((doc) => ({
    id: toId(doc._id),
    date: doc.date,
    checkIn: doc.checkIn,
    checkOut: doc.checkOut,
    isOvernight: doc.isOvernight,
  }));
}

export async function getTodayAttendance(
  userId: string,
): Promise<AttendanceRecord | null> {
  const db = await getDb();
  const today = formatDate(getKstNow());

  const doc = await db
    .collection<DbAttendanceRecord>("attendance_records")
    .findOne({ userId, date: today });

  if (!doc) return null;

  return {
    id: toId(doc._id),
    date: doc.date,
    checkIn: doc.checkIn,
    checkOut: doc.checkOut,
    isOvernight: doc.isOvernight,
  };
}

export async function checkInToday(userId: string): Promise<AttendanceRecord> {
  const db = await getDb();
  const now = getKstNow();
  const today = formatDate(now);
  const attendance = db.collection<DbAttendanceRecord>("attendance_records");

  const existing = await attendance.findOne({ userId, date: today });
  if (existing) {
    return {
      id: toId(existing._id),
      date: existing.date,
      checkIn: existing.checkIn,
      checkOut: existing.checkOut,
      isOvernight: existing.isOvernight,
    };
  }

  const doc: DbAttendanceRecord = {
    userId,
    date: today,
    checkIn: formatTime(now),
    checkOut: null,
    isOvernight: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await attendance.insertOne(doc);
  await writeMonthlyArchive(today.slice(0, 7));

  return {
    id: toId(result.insertedId),
    date: doc.date,
    checkIn: doc.checkIn,
    checkOut: doc.checkOut,
    isOvernight: doc.isOvernight,
  };
}

export async function checkOutToday(
  userId: string,
): Promise<AttendanceRecord | null> {
  const db = await getDb();
  const now = getKstNow();
  const today = formatDate(now);

  const result = await db
    .collection<DbAttendanceRecord>("attendance_records")
    .findOneAndUpdate(
      { userId, date: today, checkIn: { $ne: null } },
      {
        $set: {
          checkOut: formatTime(now),
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    );

  if (!result) return null;

  await writeMonthlyArchive(today.slice(0, 7));

  return {
    id: toId(result._id),
    date: result.date,
    checkIn: result.checkIn,
    checkOut: result.checkOut,
    isOvernight: result.isOvernight,
  };
}

export async function listLeaves(userId: string): Promise<LeaveRecord[]> {
  const db = await getDb();
  const docs = await db
    .collection<DbLeaveRecord>("leave_records")
    .find({ userId })
    .sort({ date: -1, createdAt: -1 })
    .toArray();

  return docs.map((doc) => ({
    id: toId(doc._id),
    date: doc.date,
    type: doc.type,
    duration: doc.duration,
    period: doc.period,
    reason: doc.reason,
  }));
}

export async function createLeave(
  userId: string,
  payload: Omit<LeaveRecord, "id">,
): Promise<{ leave: LeaveRecord; user: User }> {
  const db = await getDb();
  const users = db.collection<DbUser>("users");

  const existingUser = await users.findOne({ _id: userId });
  const targetUser = existingUser || (await ensureDefaultUser());

  const targetField =
    payload.type === "annual"
      ? "annualLeaveRemaining"
      : "monthlyLeaveRemaining";

  const remaining =
    payload.type === "annual"
      ? targetUser.annualLeaveRemaining
      : targetUser.monthlyLeaveRemaining;

  if (!targetUser.leaveBalanceInitialized || !targetUser.hireDate) {
    throw new Error("입사일과 초기 잔여 연차/월차를 먼저 설정해주세요");
  }

  if (remaining < payload.duration) {
    throw new Error("잔여 휴가가 부족합니다");
  }

  const calendarEventId = await createLeaveCalendarEvent({
    userName: targetUser.name,
    date: payload.date,
    type: payload.type,
    duration: payload.duration,
    period: payload.period,
    reason: payload.reason,
  });

  const now = new Date();
  const doc: DbLeaveRecord = {
    userId,
    date: payload.date,
    type: payload.type,
    duration: payload.duration,
    period: payload.period,
    reason: payload.reason,
    calendarEventId: calendarEventId || undefined,
    createdAt: now,
    updatedAt: now,
  };

  let insertedId: ObjectId;
  try {
    const inserted = await db
      .collection<DbLeaveRecord>("leave_records")
      .insertOne(doc);
    insertedId = inserted.insertedId;
  } catch (error) {
    if (calendarEventId) {
      await deleteCalendarEventById(calendarEventId);
    }
    throw error;
  }

  const updatedUser = await users.findOneAndUpdate(
    { _id: userId },
    { $inc: { [targetField]: -payload.duration } },
    { returnDocument: "after" },
  );

  if (!updatedUser) {
    throw new Error("사용자 정보를 찾을 수 없습니다");
  }

  return {
    leave: {
      id: toId(insertedId),
      date: payload.date,
      type: payload.type,
      duration: payload.duration,
      period: payload.period,
      reason: payload.reason,
    },
    user: toUser(updatedUser),
  };
}

export async function deleteLeave(
  userId: string,
  leaveId: string,
): Promise<User> {
  const db = await getDb();
  const users = db.collection<DbUser>("users");
  const leaveCollection = db.collection<DbLeaveRecord>("leave_records");
  const targetObjectId = new ObjectId(leaveId);

  const leave = await leaveCollection.findOne({ _id: targetObjectId, userId });

  if (!leave) {
    throw new Error("휴가 기록을 찾을 수 없습니다");
  }

  await deleteCalendarEventById(leave.calendarEventId);

  const deleted = await leaveCollection.deleteOne({
    _id: targetObjectId,
    userId,
  });
  if (deleted.deletedCount !== 1) {
    throw new Error("휴가 기록 삭제에 실패했습니다");
  }

  const targetField =
    leave.type === "annual" ? "annualLeaveRemaining" : "monthlyLeaveRemaining";

  const updatedUser = await users.findOneAndUpdate(
    { _id: userId },
    { $inc: { [targetField]: leave.duration } },
    { returnDocument: "after" },
  );

  if (!updatedUser) {
    throw new Error("사용자 정보를 찾을 수 없습니다");
  }

  return toUser(updatedUser);
}

export async function getStatusSummary(userId: string) {
  const db = await getDb();
  const users = db.collection<DbUser>("users");
  const userDoc = await users.findOne({ _id: userId });
  const user = userDoc ? toUser(userDoc) : await ensureDefaultUser();
  const leaves = await listLeaves(userId);
  const attendance = await listMonthlyAttendance(userId);

  const workDays = attendance.length;
  const overnightDays = attendance.filter((r) => r.isOvernight).length;
  const completedDays = attendance.filter(
    (r) => r.checkOut && !r.isOvernight,
  ).length;

  const thisMonth = formatDate(getKstNow()).slice(0, 7);
  const monthlyLeaves = leaves.filter((r) => r.date.startsWith(thisMonth));

  const usedAnnualLeave = monthlyLeaves
    .filter((r) => r.type === "annual")
    .reduce((sum, r) => sum + r.duration, 0);

  const usedMonthlyLeave = monthlyLeaves
    .filter((r) => r.type === "monthly")
    .reduce((sum, r) => sum + r.duration, 0);

  const totalAnnualLeave = user.annualLeaveRemaining + usedAnnualLeave;
  const totalMonthlyLeave = user.monthlyLeaveRemaining + usedMonthlyLeave;

  const now = getKstNow();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let plannedWorkDays = 0;
  let plannedWorkDaysToDate = 0;

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    if (user.workDays.includes(date.getDay())) {
      plannedWorkDays += 1;
      if (day <= today) {
        plannedWorkDaysToDate += 1;
      }
    }
  }

  const attendanceRate =
    plannedWorkDaysToDate === 0
      ? 0
      : Math.round((completedDays / plannedWorkDaysToDate) * 1000) / 10;

  return {
    user,
    stats: {
      workDays,
      plannedWorkDays,
      attendanceRate,
      overnightDays,
      completedDays,
      usedAnnualLeave,
      usedMonthlyLeave,
      totalAnnualLeave,
      totalMonthlyLeave,
    },
    recentAttendance: attendance.slice(0, 5),
  };
}

function normalizeWorkDays(workDays: number[]) {
  return [...new Set(workDays)]
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);
}

export async function updateUserWorkDays(
  userId: string,
  workDays: number[],
): Promise<User> {
  const normalized = normalizeWorkDays(workDays);

  if (normalized.length === 0) {
    throw new Error("최소 1개 이상의 근무 요일을 선택해주세요");
  }

  const db = await getDb();
  const users = db.collection<DbUser>("users");
  const updated = await users.findOneAndUpdate(
    { _id: userId },
    { $set: { workDays: normalized, updatedAt: new Date() } },
    { returnDocument: "after" },
  );

  if (!updated) {
    throw new Error("사용자 정보를 찾을 수 없습니다");
  }

  return toUser(updated);
}

export async function updateUserLeaveBalance(
  userId: string,
  payload: {
    annualLeaveRemaining: number;
    monthlyLeaveRemaining: number;
    hireDate?: string;
  },
): Promise<User> {
  if (payload.annualLeaveRemaining < 0 || payload.monthlyLeaveRemaining < 0) {
    throw new Error("잔여 일수는 0 이상이어야 합니다");
  }

  const db = await getDb();
  const users = db.collection<DbUser>("users");

  const existing = await users.findOne({ _id: userId });
  if (!existing) {
    throw new Error("사용자 정보를 찾을 수 없습니다");
  }

  const finalHireDate = payload.hireDate || existing.hireDate;
  if (!finalHireDate) {
    throw new Error("초기 설정 시 입사일은 필수입니다");
  }

  const hireDate = new Date(`${finalHireDate}T00:00:00`);
  if (Number.isNaN(hireDate.getTime())) {
    throw new Error("입사일 형식이 올바르지 않습니다");
  }

  const now = getKstNow();
  const monthlyGrantKey = getDueMonthlyGrantKey(now, hireDate.getDate());
  const annualGrantKey = getDueAnnualGrantKey(now, hireDate);

  const updated = await users.findOneAndUpdate(
    { _id: userId },
    {
      $set: {
        annualLeaveRemaining: payload.annualLeaveRemaining,
        monthlyLeaveRemaining: payload.monthlyLeaveRemaining,
        hireDate: finalHireDate,
        leaveBalanceInitialized: true,
        monthlyLeaveLastGrantedAt: monthlyGrantKey,
        annualLeaveLastGrantedAt: annualGrantKey,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );

  if (!updated) {
    throw new Error("사용자 정보를 찾을 수 없습니다");
  }

  return toUser(updated);
}
