import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  buildSetCookieHeader,
  getAllowedDomain,
} from "@/lib/auth-session";
import { signup } from "@/lib/password-auth";
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
    const name = formData.get("name") as string;
    const password = formData.get("password") as string;

    if (!email || !name || !password) {
      return NextResponse.redirect(
        new URL("/?tab=signup&error=" + encodeURIComponent("이메일, 이름, 비밀번호를 모두 입력해주세요"), origin),
      );
    }

    const result = await signup(email, name, password);
    const user = await ensureUserByEmail(result.email, name);

    const token = createSessionToken({
      email: result.email,
      name,
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
      error instanceof Error ? error.message : "회원가입에 실패했습니다";
    return NextResponse.redirect(
      new URL("/?tab=signup&error=" + encodeURIComponent(message), origin),
    );
  }
}
