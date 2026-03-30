"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Clock, Calendar, BarChart3, LogOut, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { type User } from "@/lib/attendance-store";

const navItems = [
  { href: "/dashboard", label: "출퇴근", icon: Clock, title: "출퇴근 기록" },
  { href: "/leave", label: "연·월차", icon: Calendar, title: "연차/월차 기록" },
  {
    href: "/calendar",
    label: "팀 캘린더",
    icon: CalendarDays,
    title: "팀 캘린더",
  },
  { href: "/status", label: "내 현황", icon: BarChart3, title: "내 현황" },
];

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const currentNav = navItems.find((item) => item.href === pathname);
  const pageTitle = currentNav?.title || "근태관리";

  useEffect(() => {
    const loadUser = async () => {
      const res = await fetch("/api/me");
      const user = (await res.json()) as User;
      setCurrentUser(user);

      const needsSetup = !user.leaveBalanceInitialized || !user.hireDate;
      if (needsSetup && pathname !== "/status") {
        router.replace("/status?setup=leave-balance");
      }
    };

    void loadUser();
  }, [pathname, router]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card md:static md:border-t-0 md:border-r md:h-screen md:w-64 md:flex-shrink-0">
      <div className="hidden md:flex md:flex-col md:h-full">
        {/* Logo area for desktop */}
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold text-foreground">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            미리내 근태관리 시스템
          </p>
        </div>

        {/* User welcome message */}
        <div className="px-6 py-4 border-b border-border bg-muted/30">
          <p className="text-sm text-foreground">
            <span className="font-medium">{currentUser?.name ?? "사용자"}</span>
            님 반갑습니다.
          </p>
        </div>

        {/* Navigation items for desktop */}
        <div className="flex-1 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={cn(
                  "flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary border-r-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Logout for desktop */}
        <div className="p-4 border-t border-border">
          <Link
            href="/api/auth/logout"
            className="flex items-center gap-3 px-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-5 w-5" />
            로그아웃
          </Link>
        </div>
      </div>

      {/* Mobile header (sticky top) */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-foreground">{pageTitle}</h1>
            <p className="text-xs text-muted-foreground">
              미리내 근태관리 시스템
            </p>
          </div>
          <p className="text-sm text-foreground">
            <span className="font-medium">{currentUser?.name ?? "사용자"}</span>
            님
          </p>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <div className="flex md:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
