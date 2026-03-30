"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Calendar, FileSpreadsheet } from "lucide-react";

type Tab = "login" | "signup";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("login");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setError(params.get("error"));
    if (params.get("tab") === "signup") {
      setTab("signup");
    }
  }, []);

  const features = [
    {
      icon: Clock,
      title: "출퇴근 기록",
      description: "버튼 하나로 간편하게",
    },
    {
      icon: Calendar,
      title: "연차/월차 기록",
      description: "승인 없이 즉시 등록",
    },
    {
      icon: FileSpreadsheet,
      title: "엑셀 내보내기",
      description: "출퇴근/연차 엑셀 저장",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:flex-1 bg-primary/5 flex-col justify-center items-center p-12">
        <div className="max-w-md">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            미리내 근태관리 시스템
          </h1>
          <p className="text-lg text-muted-foreground mb-12">
            승인 없음 · 관리자 없음 · 버튼 하나로 기록
          </p>

          <div className="space-y-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right side - login/signup form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-primary flex items-center justify-center mb-4">
              <Clock className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">
              {tab === "login" ? "로그인" : "회원가입"}
            </CardTitle>
            <CardDescription>
              {tab === "login"
                ? "이메일과 비밀번호로 로그인하세요"
                : "@mirinae.io 이메일로 가입하세요"}
            </CardDescription>
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          </CardHeader>
          <CardContent>
            {/* Tab buttons */}
            <div className="flex gap-2 mb-6">
              <Button
                variant={tab === "login" ? "default" : "outline"}
                className="flex-1"
                onClick={() => { setTab("login"); setError(null); }}
              >
                로그인
              </Button>
              <Button
                variant={tab === "signup" ? "default" : "outline"}
                className="flex-1"
                onClick={() => { setTab("signup"); setError(null); }}
              >
                회원가입
              </Button>
            </div>

            {tab === "login" ? (
              <form action="/api/auth/login" method="POST" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">이메일</Label>
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    placeholder="name@mirinae.io"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">비밀번호</Label>
                  <Input
                    id="login-password"
                    name="password"
                    type="password"
                    placeholder="비밀번호를 입력하세요"
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-12 text-base">
                  로그인
                </Button>
              </form>
            ) : (
              <form action="/api/auth/signup" method="POST" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">이메일</Label>
                  <Input
                    id="signup-email"
                    name="email"
                    type="email"
                    placeholder="name@mirinae.io"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-name">이름</Label>
                  <Input
                    id="signup-name"
                    name="name"
                    type="text"
                    placeholder="홍길동"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">비밀번호</Label>
                  <Input
                    id="signup-password"
                    name="password"
                    type="password"
                    placeholder="8자 이상"
                    required
                    minLength={8}
                  />
                </div>
                <Button type="submit" className="w-full h-12 text-base">
                  회원가입
                </Button>
              </form>
            )}

            <p className="text-xs text-muted-foreground text-center mt-6">
              @mirinae.io 도메인 이메일만 사용 가능합니다
            </p>

            {/* Mobile features */}
            <div className="mt-8 pt-6 border-t border-border lg:hidden">
              <div className="grid grid-cols-3 gap-4 text-center">
                {features.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div key={feature.title}>
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {feature.title}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
