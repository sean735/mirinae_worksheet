import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth-session";

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.url));
  clearSessionCookie(res);
  return res;
}
