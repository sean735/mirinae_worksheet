"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Calendar,
  Clock,
  Moon,
  TrendingUp,
  CalendarDays,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function downloadAllAttendanceExcel() {
  fetch("/api/attendance/export")
    .then((res) => {
      if (!res.ok) throw new Error("엑셀 다운로드 실패");
      return res.blob();
    })
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_all_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    })
    .catch((e) => {
      alert(e.message || "엑셀 다운로드 실패");
    });
}
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type AttendanceRecord, type User } from "@/lib/attendance-store";

const WORK_DAY_OPTIONS = [
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
  { value: 6, label: "토" },
  { value: 0, label: "일" },
];

export default function StatusPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>(
    [],
  );
  const [workDays, setWorkDays] = useState<number[]>([]);
  const [isSavingWorkDays, setIsSavingWorkDays] = useState(false);
  const [annualBalanceInput, setAnnualBalanceInput] = useState("0");
  const [monthlyBalanceInput, setMonthlyBalanceInput] = useState("0");
  const [hireDateInput, setHireDateInput] = useState("");
  const [isSavingBalance, setIsSavingBalance] = useState(false);
  const [statsData, setStatsData] = useState({
    workDays: 0,
    plannedWorkDays: 0,
    attendanceRate: 0,
    overnightDays: 0,
    completedDays: 0,
    usedAnnualLeave: 0,
    usedMonthlyLeave: 0,
    totalAnnualLeave: 1,
    totalMonthlyLeave: 1,
  });

  const loadSummary = async () => {
    const res = await fetch("/api/status/summary");
    const data = (await res.json()) as {
      user: User;
      stats: typeof statsData;
      recentAttendance: AttendanceRecord[];
    };

    setUser(data.user);
    setWorkDays(data.user.workDays || []);
    setAnnualBalanceInput(String(data.user.annualLeaveRemaining ?? 0));
    setMonthlyBalanceInput(String(data.user.monthlyLeaveRemaining ?? 0));
    setHireDateInput(data.user.hireDate || "");
    setStatsData(data.stats);
    setRecentAttendance(data.recentAttendance);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setIsSetupMode(params.get("setup") === "leave-balance");
    }

    void loadSummary();
  }, []);

  const stats = [
    {
      title: "이번 달 근무일",
      value: statsData.workDays,
      unit: "일",
      icon: Clock,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "예정 근무일",
      value: statsData.plannedWorkDays,
      unit: "일",
      icon: CalendarDays,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "정상 근무 완료",
      value: statsData.completedDays,
      unit: "일",
      icon: TrendingUp,
      color: "text-check-in",
      bgColor: "bg-check-in/10",
    },
    {
      title: "철야 근무",
      value: statsData.overnightDays,
      unit: "일",
      icon: Moon,
      color: "text-overnight",
      bgColor: "bg-overnight/10",
    },
    {
      title: "이번 달 휴가 사용",
      value: statsData.usedAnnualLeave + statsData.usedMonthlyLeave,
      unit: "일",
      icon: Calendar,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
  ];

  const toggleWorkDay = (day: number, checked: boolean) => {
    setWorkDays((prev) => {
      if (checked) {
        return [...new Set([...prev, day])].sort((a, b) => a - b);
      }
      return prev.filter((value) => value !== day);
    });
  };

  const saveWorkDays = async () => {
    setIsSavingWorkDays(true);

    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workDays }),
      });

      const payload = (await res.json()) as User | { message?: string };
      if (!res.ok) {
        const message =
          "message" in payload ? payload.message : "근무 요일 저장 실패";
        alert(message || "근무 요일 저장 실패");
        return;
      }

      setUser(payload as User);
      void loadSummary();
      alert("근무 요일이 저장되었습니다");
    } finally {
      setIsSavingWorkDays(false);
    }
  };

  const saveLeaveBalance = async () => {
    setIsSavingBalance(true);

    try {
      const annualLeaveRemaining = Number(annualBalanceInput);
      const monthlyLeaveRemaining = Number(monthlyBalanceInput);

      if (
        Number.isNaN(annualLeaveRemaining) ||
        Number.isNaN(monthlyLeaveRemaining)
      ) {
        alert("잔여 일수는 숫자로 입력해주세요");
        return;
      }

      if (!user?.leaveBalanceInitialized && !hireDateInput) {
        alert("초기 설정 시 입사일은 필수입니다");
        return;
      }

      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annualLeaveRemaining,
          monthlyLeaveRemaining,
          hireDate: hireDateInput || undefined,
        }),
      });

      const payload = (await res.json()) as User | { message?: string };
      if (!res.ok) {
        const message =
          "message" in payload ? payload.message : "잔여 일수 저장 실패";
        alert(message || "잔여 일수 저장 실패");
        return;
      }

      setUser(payload as User);
      void loadSummary();
      alert("잔여 연차/월차가 저장되었습니다");
    } finally {
      setIsSavingBalance(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">내 현황</h1>
          <p className="text-muted-foreground mt-1">
            {new Date().toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
            })}{" "}
            근태 현황
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={downloadAllAttendanceExcel}
        >
          <FileSpreadsheet className="h-4 w-4" />
          엑셀 내보내기
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-bold text-foreground mt-1">
                      {stat.value}
                      <span className="text-base font-normal text-muted-foreground ml-1">
                        {stat.unit}
                      </span>
                    </p>
                  </div>
                  <div
                    className={`h-10 w-10 rounded-full ${stat.bgColor} flex items-center justify-center`}
                  >
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">출근율</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">이번 달 누적 출근율</span>
            <span className="font-medium">{statsData.attendanceRate}%</span>
          </div>
          <Progress value={statsData.attendanceRate} className="h-2" />
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">근무 요일 설정</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 md:grid-cols-7 gap-3 mb-4">
            {WORK_DAY_OPTIONS.map((option) => {
              const checked = workDays.includes(option.value);
              return (
                <label
                  key={option.value}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) =>
                      toggleWorkDay(option.value, value === true)
                    }
                  />
                  <span className="text-sm text-foreground">
                    {option.label}
                  </span>
                </label>
              );
            })}
          </div>
          <Button
            onClick={saveWorkDays}
            disabled={isSavingWorkDays || workDays.length === 0}
          >
            {isSavingWorkDays ? "저장 중..." : "근무 요일 저장"}
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">잔여 휴가 초기 입력/수정</CardTitle>
        </CardHeader>
        <CardContent>
          {isSetupMode && (
            <p className="text-sm text-primary mb-3">
              최초 로그인 후 1회 설정이 필요합니다. 입사일과 현재 잔여
              연차/월차를 입력해 주세요.
            </p>
          )}

          {!user?.leaveBalanceInitialized && (
            <p className="text-sm text-amber-600 mb-4">
              기존 시스템 내역이 없으면 현재 잔여 연차/월차를 1회 입력해 주세요.
            </p>
          )}

          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="annual-balance">연차 잔여</Label>
              <Input
                id="annual-balance"
                type="number"
                min="0"
                step="0.5"
                value={annualBalanceInput}
                onChange={(e) => setAnnualBalanceInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthly-balance">월차 잔여</Label>
              <Input
                id="monthly-balance"
                type="number"
                min="0"
                step="0.5"
                value={monthlyBalanceInput}
                onChange={(e) => setMonthlyBalanceInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hire-date">
                입사일{!user?.leaveBalanceInitialized ? "(필수)" : ""}
              </Label>
              <Input
                id="hire-date"
                type="date"
                value={hireDateInput}
                onChange={(e) => setHireDateInput(e.target.value)}
              />
            </div>
          </div>

          <Button
            className="mt-4"
            onClick={saveLeaveBalance}
            disabled={isSavingBalance}
          >
            {isSavingBalance ? "저장 중..." : "잔여 휴가 저장"}
          </Button>
        </CardContent>
      </Card>

      {/* Leave balance */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-primary" />
              연차 현황
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">사용</span>
              <span className="font-medium">
                {statsData.usedAnnualLeave} / {statsData.totalAnnualLeave}일
              </span>
            </div>
            <Progress
              value={
                (statsData.usedAnnualLeave / statsData.totalAnnualLeave) * 100
              }
              className="h-2"
            />
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">잔여 연차</span>
              <span className="text-2xl font-bold text-primary">
                {user?.annualLeaveRemaining ?? 0}일
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-accent" />
              월차 현황
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">사용</span>
              <span className="font-medium">
                {statsData.usedMonthlyLeave} / {statsData.totalMonthlyLeave}일
              </span>
            </div>
            <Progress
              value={
                (statsData.usedMonthlyLeave / statsData.totalMonthlyLeave) * 100
              }
              className="h-2 [&>div]:bg-accent"
            />
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">잔여 월차</span>
              <span className="text-2xl font-bold text-accent">
                {user?.monthlyLeaveRemaining ?? 0}일
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">최근 활동</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentAttendance.map((record) => {
              const recordDate = new Date(record.date);
              return (
                <div key={record.id} className="flex items-center gap-4">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {record.isOvernight ? "철야 근무" : "정상 출퇴근"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {recordDate.toLocaleDateString("ko-KR", {
                        month: "long",
                        day: "numeric",
                        weekday: "short",
                      })}
                      {record.checkIn && ` · ${record.checkIn}`}
                      {record.checkOut && ` ~ ${record.checkOut}`}
                    </p>
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
