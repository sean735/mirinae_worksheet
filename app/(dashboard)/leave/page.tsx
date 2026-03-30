"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Plus, Trash2, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { type LeaveRecord, type User } from "@/lib/attendance-store";

type ApiErrorPayload = {
  message?: string;
  code?: string;
  action?: string;
  retryable?: boolean;
  details?: unknown;
};

function formatApiErrorMessage(payload: ApiErrorPayload, fallback: string) {
  const lines = [payload.message || fallback];

  if (payload.code) lines.push(`코드: ${payload.code}`);
  if (payload.action) lines.push(`작업: ${payload.action}`);
  if (typeof payload.retryable === "boolean") {
    lines.push(`재시도 가능: ${payload.retryable ? "예" : "아니오"}`);
  }
  if (payload.details) {
    lines.push(`상세: ${JSON.stringify(payload.details)}`);
  }

  return lines.join("\n");
}

function getTodayDateInputValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function LeavePage() {
  const [records, setRecords] = useState<LeaveRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    date: getTodayDateInputValue(),
    type: "annual" as "annual" | "monthly",
    duration: "1" as "0.5" | "1",
    period: "morning" as "morning" | "afternoon",
    reason: "",
  });

  const loadData = async () => {
    const [userRes, leavesRes] = await Promise.all([
      fetch("/api/me"),
      fetch("/api/leaves"),
    ]);

    const user = (await userRes.json()) as User;
    const leaves = (await leavesRes.json()) as LeaveRecord[];

    setCurrentUser(user);
    setRecords(leaves);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser?.leaveBalanceInitialized || !currentUser.hireDate) {
      alert("먼저 내 현황에서 입사일과 초기 잔여 휴가를 설정해주세요");
      return;
    }

    const payload: Omit<LeaveRecord, "id"> = {
      date: formData.date,
      type: formData.type,
      duration: parseFloat(formData.duration) as 0.5 | 1,
      period: formData.duration === "0.5" ? formData.period : undefined,
      reason: formData.reason || undefined,
    };

    if (currentUser) {
      const remaining =
        payload.type === "annual"
          ? currentUser.annualLeaveRemaining
          : currentUser.monthlyLeaveRemaining;

      if (remaining < payload.duration) {
        alert("잔여 휴가가 부족하여 등록할 수 없습니다");
        return;
      }
    }

    const res = await fetch("/api/leaves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const error = (await res.json()) as ApiErrorPayload;
      alert(formatApiErrorMessage(error, "휴가 등록에 실패했습니다"));
      return;
    }

    const result = (await res.json()) as { leave: LeaveRecord; user: User };
    setRecords((prev) => [result.leave, ...prev]);
    setCurrentUser(result.user);
    setFormData({
      date: getTodayDateInputValue(),
      type: "annual",
      duration: "1",
      period: "morning",
      reason: "",
    });
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/leaves/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const error = (await res.json()) as ApiErrorPayload;
      alert(formatApiErrorMessage(error, "휴가 삭제에 실패했습니다"));
      return;
    }

    const user = (await res.json()) as User;
    setCurrentUser(user);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const getTypeLabel = (type: "annual" | "monthly") => {
    return type === "annual" ? "연차" : "월차";
  };

  const getDurationLabel = (record: LeaveRecord) => {
    if (record.duration === 1) return "1일";
    return record.period === "morning" ? "오전 반일" : "오후 반일";
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            연차 / 월차 관리
          </h1>
          <p className="text-muted-foreground mt-1">
            승인 없이 바로 등록됩니다 · Google Calendar 자동 연동
          </p>
        </div>
      </div>

      {/* Remaining leaves */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">연차 잔여</p>
                <p className="text-2xl font-bold text-foreground">
                  {currentUser?.annualLeaveRemaining ?? 0}일
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">월차 잔여</p>
                <p className="text-2xl font-bold text-foreground">
                  {currentUser?.monthlyLeaveRemaining ?? 0}일
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add leave button */}
      {!showForm && (
        <Button
          onClick={() => setShowForm(true)}
          className="w-full mb-6 gap-2"
          disabled={
            !currentUser?.leaveBalanceInitialized || !currentUser.hireDate
          }
        >
          <Plus className="h-4 w-4" />
          연차/월차 등록
        </Button>
      )}

      {(!currentUser?.leaveBalanceInitialized || !currentUser.hireDate) && (
        <p className="text-sm text-amber-600 mb-6">
          휴가를 등록하려면 먼저 내 현황 탭에서 입사일과 초기 잔여 휴가를
          설정해야 합니다.
        </p>
      )}

      {/* Add leave form */}
      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">휴가 등록</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">날짜</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">종류</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: "annual" | "monthly") =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="annual">연차</SelectItem>
                      <SelectItem value="monthly">월차</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duration">일수</Label>
                  <Select
                    value={formData.duration}
                    onValueChange={(value: "0.5" | "1") =>
                      setFormData({ ...formData, duration: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">하루 (1일)</SelectItem>
                      <SelectItem value="0.5">반일 (0.5일)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.duration === "0.5" && (
                  <div className="space-y-2">
                    <Label htmlFor="period">시간대</Label>
                    <Select
                      value={formData.period}
                      onValueChange={(value: "morning" | "afternoon") =>
                        setFormData({ ...formData, period: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="morning">오전</SelectItem>
                        <SelectItem value="afternoon">오후</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">사유 (선택)</Label>
                <Textarea
                  id="reason"
                  placeholder="휴가 사유를 입력하세요 (선택사항)"
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  rows={2}
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit" className="flex-1">
                  등록
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  className="flex-1"
                >
                  취소
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Leave records list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">휴가 기록</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              등록된 휴가가 없습니다
            </p>
          ) : (
            <div className="space-y-3">
              {records.map((record) => {
                const recordDate = new Date(record.date);
                return (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium",
                          record.type === "annual"
                            ? "bg-primary/10 text-primary"
                            : "bg-accent/10 text-accent",
                        )}
                      >
                        {recordDate.getDate()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {recordDate.toLocaleDateString("ko-KR", {
                              month: "long",
                              day: "numeric",
                              weekday: "short",
                            })}
                          </span>
                          <Badge
                            variant="secondary"
                            className={cn(
                              record.type === "annual"
                                ? "bg-primary/10 text-primary"
                                : "bg-accent/10 text-accent",
                            )}
                          >
                            {getTypeLabel(record.type)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {getDurationLabel(record)}
                          {record.reason && ` · ${record.reason}`}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(record.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
