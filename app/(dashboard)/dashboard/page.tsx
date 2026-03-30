"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, CheckCircle2, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getKoreanDayName,
  type AttendanceRecord,
  type User,
} from "@/lib/attendance-store";

type AttendanceStatus = "not-checked-in" | "checked-in" | "completed";

export default function DashboardPage() {
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [status, setStatus] = useState<AttendanceStatus>("not-checked-in");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);

  const todayDay = new Date().getDay();
  const isWorkDay = user?.workDays?.includes(todayDay) ?? true;

  const loadData = async () => {
    const [todayRes, monthlyRes, meRes] = await Promise.all([
      fetch("/api/attendance/today"),
      fetch("/api/attendance/monthly"),
      fetch("/api/me"),
    ]);

    const todayData = (await todayRes.json()) as AttendanceRecord | null;
    const monthlyData = (await monthlyRes.json()) as AttendanceRecord[];
    const meData = (await meRes.json()) as User;

    setTodayRecord(todayData);
    setRecords(monthlyData);
    setUser(meData);

    if (!todayData) {
      setStatus("not-checked-in");
      return;
    }

    if (todayData.checkOut) {
      setStatus("completed");
    } else if (todayData.checkIn) {
      setStatus("checked-in");
    }
  };

  useEffect(() => {
    setMounted(true);
    setCurrentTime(new Date());

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    void loadData();

    return () => clearInterval(timer);
  }, []);

  // 첫 진입 시 IP/포트 안내 토스트
  useEffect(() => {
    if (mounted) {
      const url = window.location.origin;
      toast({
        title: "이 주소로 접속하시면 됩니다!",
        description: url,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const handleCheckIn = async () => {
    if (!isWorkDay) {
      const confirmed = window.confirm(
        "비근무일입니다. 정말 출근하시나요? 확인을 누르면 출근 처리됩니다.",
      );
      if (!confirmed) {
        return;
      }
    }

    await fetch("/api/attendance/check-in", { method: "POST" });
    await loadData();
  };

  const handleCheckOut = async () => {
    await fetch("/api/attendance/check-out", { method: "POST" });
    await loadData();
  };

  const getStatusButton = () => {
    switch (status) {
      case "not-checked-in":
        return (
          <Button
            onClick={handleCheckIn}
            size="lg"
            className="h-32 w-32 rounded-full text-xl font-bold bg-check-in hover:bg-check-in/90 text-white shadow-lg shadow-check-in/30 transition-all hover:scale-105"
          >
            <div className="flex flex-col items-center gap-2">
              <Clock className="h-8 w-8" />
              <span>출근</span>
            </div>
          </Button>
        );
      case "checked-in":
        return (
          <Button
            onClick={handleCheckOut}
            size="lg"
            className="h-32 w-32 rounded-full text-xl font-bold bg-check-out hover:bg-check-out/90 text-white shadow-lg shadow-check-out/30 transition-all hover:scale-105"
          >
            <div className="flex flex-col items-center gap-2">
              <Clock className="h-8 w-8" />
              <span>퇴근</span>
            </div>
          </Button>
        );
      case "completed":
        return (
          <div className="h-32 w-32 rounded-full bg-muted flex flex-col items-center justify-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mb-2 text-check-in" />
            <span className="text-sm font-medium">근무 완료</span>
          </div>
        );
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Main attendance card */}
      <Card className="mb-8">
        <CardContent className="pt-8 pb-8">
          <div className="flex flex-col items-center gap-6">
            {/* Current time display */}
            <div className="text-center">
              <div className="text-5xl font-mono font-bold text-foreground tabular-nums">
                {mounted && currentTime
                  ? currentTime.toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: false,
                    })
                  : "--:--:--"}
              </div>
            </div>

            {/* Status button */}
            <div className="my-4">{getStatusButton()}</div>

            {!isWorkDay && status === "not-checked-in" && (
              <p className="text-sm text-amber-600">
                오늘은 비근무일로 설정되어 있습니다.
              </p>
            )}

            {/* Today's record */}
            {todayRecord && (
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                {todayRecord.checkIn && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-check-in" />
                    <span>출근 {todayRecord.checkIn}</span>
                  </div>
                )}
                {todayRecord.checkOut && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-check-out" />
                    <span>퇴근 {todayRecord.checkOut}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Monthly records */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            이번 달 출퇴근 기록
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {records.slice(0, 10).map((record) => {
              const recordDate = new Date(record.date);
              return (
                <div
                  key={record.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg",
                    record.isOvernight ? "bg-overnight/10" : "bg-muted/50",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-sm">
                      <span className="font-medium text-foreground">
                        {recordDate.getMonth() + 1}/{recordDate.getDate()}
                      </span>
                      <span className="text-muted-foreground ml-1">
                        ({getKoreanDayName(recordDate)})
                      </span>
                    </div>
                    {record.isOvernight && (
                      <Badge
                        variant="secondary"
                        className="bg-overnight/20 text-overnight-foreground"
                      >
                        <Moon className="h-3 w-3 mr-1" />
                        철야
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-check-in" />
                      <span className="text-muted-foreground">
                        {record.checkIn || "-"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-check-out" />
                      <span className="text-muted-foreground">
                        {record.checkOut || "-"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
