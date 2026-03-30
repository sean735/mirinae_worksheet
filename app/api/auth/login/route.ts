import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  buildSetCookieHeader,
  getAllowedDomain,
} from "@/lib/auth-session";
import { login } from "@/lib/password-auth";
import { ensureUserByEmail } from "@/lib/server-data";

function getOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;

  const host = req.headers.get("host");
  if (host && !host.includes(":3000")) return `https://${host}`;

  return process.env.APP_BASE_URL || "http://localhost:3000";
}

export async function POST(req: NextRequest) {
  const origin = getOrigin(req);

  try {
    const formData = await req.formData();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      return NextResponse.redirect(
        new URL("/?error=" + encodeURIComponent("이메일과 비밀번호를 입력해주세요"), origin),
      );
    }

    const result = await login(email, password);
    const user = await ensureUserByEmail(result.email);

    const token = createSessionToken({
      email: result.email,
      name: user.name,
      domain: getAllowedDomain(),
    });

    const needsSetup = !user.leaveBalanceInitialized || !user.hireDate;
    const redirectPath = needsSetup ? "/status?setup=leave-balance" : "/dashboard";
    const redirectUrl = new URL(redirectPath, origin).toString();

    return new NextResponse(
      `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${redirectUrl}"></head><body>Redirecting...</body></html>`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/html",
          "Set-Cookie": buildSetCookieHeader(token),
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "로그인에 실패했습니다";
    return NextResponse.redirect(
      new URL("/?error=" + encodeURIComponent(message), origin),
    );
  }
}
