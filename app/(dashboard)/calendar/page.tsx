"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CalendarDays, ExternalLink } from "lucide-react";

type CalendarEventSummary = {
  id: string;
  summary: string;
  start: string;
  end: string;
  htmlLink: string;
};

function getDefaultMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatEventDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CalendarPage() {
  const [month, setMonth] = useState(getDefaultMonth());
  const [events, setEvents] = useState<CalendarEventSummary[]>([]);
  const [error, setError] = useState("");

  const calendarId = process.env.NEXT_PUBLIC_GOOGLE_TEAM_CALENDAR_ID || "";

  const embedUrl = useMemo(() => {
    if (!calendarId) return "";
    return `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calendarId)}&ctz=Asia/Seoul`;
  }, [calendarId]);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/calendar/events?month=${month}`, {
        cache: "default",
      });

      if (!res.ok) {
        const payload = (await res.json()) as { message?: string };
        setError(payload.message || "캘린더 이벤트를 불러오지 못했습니다.");
        setEvents([]);
        return;
      }

      const payload = (await res.json()) as {
        events: CalendarEventSummary[];
      };

      setError("");
      setEvents(payload.events || []);
    };

    void load();
  }, [month]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">팀 캘린더</h1>
          <p className="text-sm text-muted-foreground mt-1">
            연차/월차 이벤트만 Google Calendar와 동기화됩니다.
          </p>
        </div>
        <div className="w-40">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5" />
              Google Calendar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {embedUrl ? (
              <iframe
                title="Team Google Calendar"
                src={embedUrl}
                className="w-full h-[720px] rounded-md border"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                `NEXT_PUBLIC_GOOGLE_TEAM_CALENDAR_ID`가 설정되지 않았습니다.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{month} 이벤트</CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : events.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                이달의 이벤트가 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="rounded-md border p-3">
                    <p className="text-sm font-medium text-foreground">
                      {event.summary}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatEventDate(event.start)} ~{" "}
                      {formatEventDate(event.end)}
                    </p>
                    {event.htmlLink && (
                      <a
                        href={event.htmlLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-primary"
                      >
                        일정 열기
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
