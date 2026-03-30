import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  setSessionCookie,
  getAllowedDomain,
} from "@/lib/auth-session";
import { login } from "@/lib/password-auth";
import { ensureUserByEmail } from "@/lib/server-data";

function toBase(path: string) {
  return new URL(path, process.env.APP_BASE_URL || "http://localhost:3000");
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      return NextResponse.redirect(
        toBase("/?error=" + encodeURIComponent("이메일과 비밀번호를 입력해주세요")),
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
    const res = NextResponse.redirect(toBase(redirectPath));
    setSessionCookie(res, token);
    return res;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "로그인에 실패했습니다";
    return NextResponse.redirect(
      toBase("/?error=" + encodeURIComponent(message)),
    );
  }
}
