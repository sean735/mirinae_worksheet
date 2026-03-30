import { google } from "googleapis";

type LeaveCalendarPayload = {
  userName: string;
  date: string;
  type: "annual" | "monthly";
  duration: 0.5 | 1;
  period?: "morning" | "afternoon";
  reason?: string;
};

const KST = "Asia/Seoul";

function isCalendarEnabled() {
  return (
    process.env.GOOGLE_CALENDAR_ENABLED === "true" &&
    Boolean(process.env.GOOGLE_CALENDAR_ID) &&
    Boolean(process.env.GOOGLE_CLIENT_EMAIL) &&
    Boolean(process.env.GOOGLE_PRIVATE_KEY)
  );
}

function getServiceAccountAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL!;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
}

function getCalendarClient() {
  return google.calendar({ version: "v3", auth: getServiceAccountAuth() });
}

function addOneDay(dateText: string) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildSummary(payload: LeaveCalendarPayload) {
  const leaveLabel = payload.type === "annual" ? "연차" : "월차";
  const periodLabel =
    payload.duration === 0.5
      ? ` (${payload.period === "morning" ? "오전" : "오후"})`
      : "";
  return `[${payload.userName}] ${leaveLabel}${periodLabel}`;
}

function buildDescription(payload: LeaveCalendarPayload) {
  const typeLine = `종류: ${payload.type === "annual" ? "연차" : "월차"}`;
  const durationLine = `일수: ${payload.duration}`;
  const reasonLine = `사유: ${payload.reason || "-"}`;
  return [typeLine, durationLine, reasonLine].join("\n");
}

/** Create a leave event on the company calendar. Returns event ID or null. */
export async function createLeaveCalendarEvent(
  payload: LeaveCalendarPayload,
): Promise<string | null> {
  if (!isCalendarEnabled()) return null;

  try {
    const calendarId = process.env.GOOGLE_CALENDAR_ID!;
    const calendar = getCalendarClient();
    const summary = buildSummary(payload);
    const description = buildDescription(payload);

    if (payload.duration === 1) {
      const result = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary,
          description,
          start: { date: payload.date },
          end: { date: addOneDay(payload.date) },
        },
      });
      return result.data.id || null;
    }

    const isMorning = payload.period === "morning";
    const startTime = isMorning ? "09:00:00" : "14:00:00";
    const endTime = isMorning ? "13:00:00" : "18:00:00";

    const result = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary,
        description,
        start: { dateTime: `${payload.date}T${startTime}`, timeZone: KST },
        end: { dateTime: `${payload.date}T${endTime}`, timeZone: KST },
      },
    });
    return result.data.id || null;
  } catch (error) {
    console.error("[google-calendar] Failed to create event:", error);
    return null;
  }
}

/** Delete a calendar event. Silently fails if not found. */
export async function deleteCalendarEventById(eventId?: string) {
  if (!isCalendarEnabled() || !eventId) return;

  try {
    const calendarId = process.env.GOOGLE_CALENDAR_ID!;
    const calendar = getCalendarClient();
    await calendar.events.delete({ calendarId, eventId });
  } catch (error) {
    console.error("[google-calendar] Failed to delete event:", error);
  }
}
