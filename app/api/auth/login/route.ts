import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  setSessionCookie,
  getAllowedDomain,
} from "@/lib/auth-session";
import { login } from "@/lib/password-auth";
import { ensureUserByEmail } from "@/lib/server-data";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = (await req.json()) as {
      email: string;
      password: string;
    };

    if (!email || !password) {
      return NextResponse.json(
        { message: "이메일과 비밀번호를 입력해주세요" },
        { status: 400 },
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
    const res = NextResponse.json({
      ok: true,
      redirect: needsSetup ? "/status?setup=leave-balance" : "/dashboard",
    });
    setSessionCookie(res, token);
    return res;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "로그인에 실패했습니다";
    return NextResponse.json({ message }, { status: 400 });
  }
}
