import { NextResponse } from "next/server";

const REQUIRED_VARS = [
  "APP_BASE_URL",
  "AUTH_SESSION_SECRET",
  "ALLOWED_GOOGLE_DOMAIN",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_OAUTH_REDIRECT_URI",
] as const;

export async function GET() {
  const checks = REQUIRED_VARS.map((name) => ({
    name,
    configured: Boolean(process.env[name]),
  }));

  const missing = checks
    .filter((item) => !item.configured)
    .map((item) => item.name);

  return NextResponse.json({
    ok: missing.length === 0,
    checks,
    missing,
    domain: process.env.ALLOWED_GOOGLE_DOMAIN || "mirinae.io",
    message:
      missing.length === 0
        ? "Google 로그인 설정이 준비되었습니다"
        : "Google 로그인 필수 설정이 누락되었습니다",
  });
}
