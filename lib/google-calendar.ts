import { google } from "googleapis";

type LeaveCalendarPayload = {
  userName: string;
  date: string;
  type: "annual" | "monthly";
  duration: 0.5 | 1;
  period?: "morning" | "afternoon";
  reason?: string;
};

type CalendarEventSummary = {
  id: string;
  summary: string;
  start: string;
  end: string;
  htmlLink: string;
};

const KST = "Asia/Seoul";

export class CalendarIntegrationError extends Error {
  status: number;
  code: string;
  action: string;
  retryable: boolean;
  details?: unknown;

  constructor(params: {
    message: string;
    status?: number;
    code?: string;
    action: string;
    retryable?: boolean;
    details?: unknown;
  }) {
    super(params.message);
    this.name = "CalendarIntegrationError";
    this.status = params.status ?? 500;
    this.code = params.code ?? "CALENDAR_ERROR";
    this.action = params.action;
    this.retryable = params.retryable ?? false;
    this.details = params.details;
  }
}

function isRetryableStatus(status?: number) {
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseGoogleError(
  action: string,
  error: unknown,
): CalendarIntegrationError {
  const e = error as {
    message?: string;
    code?: number | string;
    response?: {
      status?: number;
      data?: {
        error?: {
          code?: number;
          message?: string;
          status?: string;
          errors?: Array<{ reason?: string; message?: string }>;
        };
      };
    };
  };

  const status =
    e.response?.status ?? (typeof e.code === "number" ? e.code : 500);
  const googleError = e.response?.data?.error;
  const message =
    googleError?.message || e.message || "Google Calendar 요청 실패";
  const reason = googleError?.errors?.[0]?.reason;

  return new CalendarIntegrationError({
    message,
    action,
    status,
    code: reason || googleError?.status || "GOOGLE_API_ERROR",
    retryable: isRetryableStatus(status),
    details: {
      googleStatus: googleError?.status,
      googleCode: googleError?.code,
      reason,
      raw: e.response?.data,
    },
  });
}

async function runWithRetry<T>(
  action: string,
  fn: () => Promise<T>,
): Promise<T> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const parsed = parseGoogleError(action, error);
      const shouldRetry = parsed.retryable && attempt < maxAttempts;

      if (!shouldRetry) {
        throw parsed;
      }

      await sleep(500 * attempt);
    }
  }

  throw new CalendarIntegrationError({
    message: "Google Calendar 재시도 한도를 초과했습니다",
    action,
    status: 502,
    code: "RETRY_EXHAUSTED",
    retryable: false,
  });
}

function isCalendarEnabled() {
  return process.env.GOOGLE_CALENDAR_ENABLED === "true";
}

function getCalendarId() {
  return process.env.GOOGLE_CALENDAR_ID || "";
}

function getServiceAccountAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new CalendarIntegrationError({
      message: "Google Calendar 서비스 계정 환경변수가 설정되지 않았습니다",
      action: "auth",
      status: 500,
      code: "CALENDAR_CONFIG_MISSING",
      retryable: false,
      details: {
        hasClientEmail: Boolean(clientEmail),
        hasPrivateKey: Boolean(privateKey),
      },
    });
  }

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
}

function getCalendarClient() {
  const auth = getServiceAccountAuth();
  return google.calendar({ version: "v3", auth });
}

function addOneDay(dateText: string) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildLeaveSummary(payload: LeaveCalendarPayload) {
  const leaveLabel = payload.type === "annual" ? "연차" : "월차";
  const periodLabel =
    payload.duration === 0.5
      ? ` (${payload.period === "morning" ? "오전" : "오후"})`
      : "";
  return `[${payload.userName}] ${leaveLabel}${periodLabel}`;
}

function buildLeaveDescription(payload: LeaveCalendarPayload) {
  const reasonLine = payload.reason ? `사유: ${payload.reason}` : "사유: -";
  const typeLine = `종류: ${payload.type === "annual" ? "연차" : "월차"}`;
  const durationLine = `일수: ${payload.duration}`;
  return [typeLine, durationLine, reasonLine].join("\n");
}

export async function createLeaveCalendarEvent(
  payload: LeaveCalendarPayload,
): Promise<string | null> {
  if (!isCalendarEnabled()) {
    return null;
  }

  const calendarId = getCalendarId();
  if (!calendarId) {
    throw new CalendarIntegrationError({
      message: "GOOGLE_CALENDAR_ID가 비어 있습니다",
      action: "create-event",
      status: 500,
      code: "CALENDAR_ID_MISSING",
      retryable: false,
    });
  }

  const calendar = getCalendarClient();
  const summary = buildLeaveSummary(payload);
  const description = buildLeaveDescription(payload);

  if (payload.duration === 1) {
    const result = await runWithRetry("create-event", () =>
      calendar.events.insert({
        calendarId,
        requestBody: {
          summary,
          description,
          start: { date: payload.date },
          end: { date: addOneDay(payload.date) },
        },
      }),
    );

    return result.data.id || null;
  }

  const isMorning = payload.period === "morning";
  const startTime = isMorning ? "09:00:00" : "14:00:00";
  const endTime = isMorning ? "13:00:00" : "18:00:00";

  const result = await runWithRetry("create-event", () =>
    calendar.events.insert({
      calendarId,
      requestBody: {
        summary,
        description,
        start: {
          dateTime: `${payload.date}T${startTime}`,
          timeZone: KST,
        },
        end: {
          dateTime: `${payload.date}T${endTime}`,
          timeZone: KST,
        },
      },
    }),
  );

  return result.data.id || null;
}

export async function deleteCalendarEventById(eventId?: string) {
  if (!isCalendarEnabled() || !eventId) {
    return;
  }

  const calendarId = getCalendarId();
  if (!calendarId) {
    throw new CalendarIntegrationError({
      message: "GOOGLE_CALENDAR_ID가 비어 있습니다",
      action: "delete-event",
      status: 500,
      code: "CALENDAR_ID_MISSING",
      retryable: false,
    });
  }

  const calendar = getCalendarClient();
  await runWithRetry("delete-event", () =>
    calendar.events.delete({ calendarId, eventId }),
  );
}

export async function listCalendarEventsByMonth(
  yearMonth: string,
): Promise<CalendarEventSummary[]> {
  if (!isCalendarEnabled()) {
    return [];
  }

  const calendarId = getCalendarId();
  if (!calendarId) {
    throw new CalendarIntegrationError({
      message: "GOOGLE_CALENDAR_ID가 비어 있습니다",
      action: "list-events",
      status: 500,
      code: "CALENDAR_ID_MISSING",
      retryable: false,
    });
  }

  const [yearText, monthText] = yearMonth.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));

  const calendar = getCalendarClient();
  const result = await runWithRetry("list-events", () =>
    calendar.events.list({
      calendarId,
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 500,
    }),
  );

  const items = result.data.items || [];
  return items
    .filter((item) => item.id && item.summary)
    .map((item) => ({
      id: item.id || "",
      summary: item.summary || "(제목 없음)",
      start: item.start?.dateTime || item.start?.date || "",
      end: item.end?.dateTime || item.end?.date || "",
      htmlLink: item.htmlLink || "",
    }));
}
