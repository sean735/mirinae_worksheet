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
import { Clock, Calendar, Zap } from "lucide-react";

type Tab = "login" | "signup";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("login");
  const [isLoading, setIsLoading] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form
  const [signupEmail, setSignupEmail] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setError(params.get("error"));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message);
        return;
      }

      window.location.href = data.redirect;
    } catch {
      setError("로그인 중 오류가 발생했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (signupPassword !== signupConfirm) {
      setError("비밀번호가 일치하지 않습니다");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: signupEmail,
          name: signupName,
          password: signupPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message);
        return;
      }

      window.location.href = data.redirect;
    } catch {
      setError("회원가입 중 오류가 발생했습니다");
    } finally {
      setIsLoading(false);
    }
  };

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
      icon: Zap,
      title: "Google Calendar",
      description: "자동 연동",
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
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">이메일</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="name@mirinae.io"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">비밀번호</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="비밀번호를 입력하세요"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 text-base"
                  disabled={isLoading}
                >
                  {isLoading ? "로그인 중..." : "로그인"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">이메일</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="name@mirinae.io"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-name">이름</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="홍길동"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">비밀번호</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="8자 이상"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">비밀번호 확인</Label>
                  <Input
                    id="signup-confirm"
                    type="password"
                    placeholder="비밀번호를 다시 입력하세요"
                    value={signupConfirm}
                    onChange={(e) => setSignupConfirm(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 text-base"
                  disabled={isLoading}
                >
                  {isLoading ? "가입 중..." : "회원가입"}
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
