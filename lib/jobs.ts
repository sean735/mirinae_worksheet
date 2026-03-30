import { getDb } from "@/lib/mongodb";
import { formatDate, getKstNow } from "@/lib/attendance-store";
import {
  ensureMonthlyArchiveExists,
  getPreviousMonth,
  getYearMonth,
  writeMonthlyArchive,
} from "@/lib/monthly-archive";

const MONTHLY_ARCHIVE_STATE_ID = "monthly_archive";

type SystemStateDoc = {
  _id: string;
  lastArchivedMonth?: string;
  updatedAt?: Date;
};

type JobLogDoc = {
  jobName: string;
  status: "success" | "failed";
  message: string;
  payload?: Record<string, unknown>;
  createdAt: Date;
};

async function writeJobLog(
  jobName: string,
  status: "success" | "failed",
  message: string,
  payload?: Record<string, unknown>,
) {
  const db = await getDb();
  await db.collection<JobLogDoc>("job_logs").insertOne({
    jobName,
    status,
    message,
    payload,
    createdAt: new Date(),
  });
}

function shiftDate(date: Date, offsetDays: number): Date {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + offsetDays);
  return shifted;
}

export async function runOvernightAttendanceJob() {
  const db = await getDb();
  const yesterday = formatDate(shiftDate(getKstNow(), -1));

  try {
    const result = await db.collection("attendance_records").updateMany(
      {
        date: yesterday,
        checkIn: { $ne: null },
        checkOut: null,
        isOvernight: { $ne: true },
      },
      {
        $set: {
          isOvernight: true,
          remark: "철야",
          updatedAt: new Date(),
        },
      },
    );

    await writeMonthlyArchive(yesterday.slice(0, 7));

    await writeJobLog(
      "overnight-attendance",
      "success",
      "철야 자동 처리 완료",
      { date: yesterday, modifiedCount: result.modifiedCount },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    await writeJobLog("overnight-attendance", "failed", message, {
      date: yesterday,
    });
    throw error;
  }
}

async function getLastArchivedMonth(): Promise<string | null> {
  const db = await getDb();
  const state = await db
    .collection<SystemStateDoc>("system_state")
    .findOne({ _id: MONTHLY_ARCHIVE_STATE_ID });
  return state?.lastArchivedMonth || null;
}

async function setLastArchivedMonth(yearMonth: string) {
  const db = await getDb();
  await db
    .collection<SystemStateDoc>("system_state")
    .updateOne(
      { _id: MONTHLY_ARCHIVE_STATE_ID },
      { $set: { lastArchivedMonth: yearMonth, updatedAt: new Date() } },
      { upsert: true },
    );
}

function monthToDate(yearMonth: string): Date {
  const [yearText, monthText] = yearMonth.split("-");
  return new Date(Number(yearText), Number(monthText) - 1, 1);
}

function nextMonth(yearMonth: string): string {
  const date = monthToDate(yearMonth);
  date.setMonth(date.getMonth() + 1);
  return getYearMonth(date);
}

export async function runMonthlyArchiveRolloverJob() {
  const now = getKstNow();
  const currentMonth = getYearMonth(now);
  const previousMonth = getPreviousMonth(currentMonth);

  try {
    await ensureMonthlyArchiveExists(currentMonth);

    let cursor = await getLastArchivedMonth();
    const archivedMonths: string[] = [];

    if (!cursor) {
      await writeMonthlyArchive(previousMonth);
      await setLastArchivedMonth(previousMonth);
      archivedMonths.push(previousMonth);
      await writeJobLog(
        "monthly-archive-rollover",
        "success",
        "초기 월별 아카이브 생성 완료",
        {
          currentMonth,
          archivedMonths,
        },
      );
      return;
    }

    while (cursor !== previousMonth) {
      const toArchive = nextMonth(cursor);
      await writeMonthlyArchive(toArchive);
      await setLastArchivedMonth(toArchive);
      archivedMonths.push(toArchive);
      cursor = toArchive;
    }

    await writeJobLog(
      "monthly-archive-rollover",
      "success",
      "월별 아카이브 점검 완료",
      {
        currentMonth,
        archivedMonths,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    await writeJobLog("monthly-archive-rollover", "failed", message, {
      currentMonth,
    });
    throw error;
  }
}
