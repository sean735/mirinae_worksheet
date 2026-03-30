import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  setSessionCookie,
  getAllowedDomain,
} from "@/lib/auth-session";
import { getGoogleProfileFromCode } from "@/lib/google-oauth";
import { ensureUserByEmail } from "@/lib/server-data";

function toBase(path: string) {
  return new URL(path, process.env.APP_BASE_URL || "http://localhost:3000");
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const denied = req.nextUrl.searchParams.get("error");

  if (denied) {
    return NextResponse.redirect(
      toBase(
        `/?error=${encodeURIComponent("Google 로그인 권한이 거부되었습니다")}`,
      ),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      toBase(`/?error=${encodeURIComponent("인증 코드가 없습니다")}`),
    );
  }

  try {
    const profile = await getGoogleProfileFromCode(code);
    const user = await ensureUserByEmail(profile.email, profile.name);

    const token = createSessionToken({
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      domain: profile.hd || getAllowedDomain(),
    });

    const needsSetup = !user.leaveBalanceInitialized || !user.hireDate;
    const nextPath = needsSetup ? "/status?setup=leave-balance" : "/dashboard";
    const res = NextResponse.redirect(toBase(nextPath));
    setSessionCookie(res, token);
    return res;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Google 로그인 처리 실패";
    return NextResponse.redirect(
      toBase(`/?error=${encodeURIComponent(message)}`),
    );
  }
}
