"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const CALENDAR_ID = process.env.NEXT_PUBLIC_GOOGLE_TEAM_CALENDAR_ID || "team@mirinae.io";

export default function CalendarPage() {
  const calendarSrc = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(CALENDAR_ID)}&ctz=Asia%2FSeoul&wkst=2&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=1&showTz=0`;

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">팀 캘린더</h2>
          <p className="text-sm text-muted-foreground mt-1">
            CEO 일정을 함께 보려면 브라우저에서 <strong>team@mirinae.io</strong> Google 계정으로 로그인하세요.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a
            href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(CALENDAR_ID)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Google Calendar에서 열기
          </a>
        </Button>
      </div>

      <div className="w-full rounded-lg border border-border overflow-hidden bg-white" style={{ height: "calc(100vh - 180px)" }}>
        <iframe
          src={calendarSrc}
          className="w-full h-full border-0"
          title="팀 캘린더"
        />
      </div>
    </div>
  );
}
