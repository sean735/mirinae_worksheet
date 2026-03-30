export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.ENABLE_SCHEDULER !== "false"
  ) {
    const { startAttendanceScheduler } = await import("@/lib/scheduler");
    startAttendanceScheduler();
  }
}
