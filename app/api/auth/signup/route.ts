import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  setSessionCookie,
  getAllowedDomain,
} from "@/lib/auth-session";
import { signup } from "@/lib/password-auth";
import { ensureUserByEmail } from "@/lib/server-data";

export async function POST(req: NextRequest) {
  try {
    const { email, name, password } = (await req.json()) as {
      email: string;
      name: string;
      password: string;
    };

    if (!email || !name || !password) {
      return NextResponse.json(
        { message: "이메일, 이름, 비밀번호를 모두 입력해주세요" },
        { status: 400 },
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
    const res = NextResponse.json({
      ok: true,
      redirect: needsSetup ? "/status?setup=leave-balance" : "/dashboard",
    });
    setSessionCookie(res, token);
    return res;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "회원가입에 실패했습니다";
    return NextResponse.json({ message }, { status: 400 });
  }
}
