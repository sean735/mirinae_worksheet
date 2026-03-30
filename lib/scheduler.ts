import { getKstNow } from "@/lib/attendance-store";
import {
  runMonthlyArchiveRolloverJob,
  runOvernightAttendanceJob,
} from "@/lib/jobs";

declare global {
  // eslint-disable-next-line no-var
  var _attendanceSchedulerStarted: boolean | undefined;
  // eslint-disable-next-line no-var
  var _attendanceSchedulerLastDailyRun: string | undefined;
}

function getDailyKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function runDailyJobs(date: Date) {
  const key = getDailyKey(date);
  if (global._attendanceSchedulerLastDailyRun === key) {
    return;
  }

  await runOvernightAttendanceJob();
  await runMonthlyArchiveRolloverJob();
  global._attendanceSchedulerLastDailyRun = key;
}

export function startAttendanceScheduler() {
  if (global._attendanceSchedulerStarted) {
    return;
  }
  global._attendanceSchedulerStarted = true;

  // Startup catch-up for missed monthly rollover.
  void runMonthlyArchiveRolloverJob().catch((error) => {
    console.error("[scheduler] monthly rollover startup failed", error);
  });

  setInterval(() => {
    const now = getKstNow();
    if (global._attendanceSchedulerLastDailyRun === getDailyKey(now)) {
      return;
    }

    void runDailyJobs(now).catch((error) => {
      console.error("[scheduler] daily job failed", error);
    });
  }, 30_000);
}
