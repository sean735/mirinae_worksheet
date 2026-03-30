import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth-session";

export async function GET() {
  const res = NextResponse.redirect(
    new URL("/", process.env.APP_BASE_URL || "http://localhost:3000"),
  );
  clearSessionCookie(res);
  return res;
}
