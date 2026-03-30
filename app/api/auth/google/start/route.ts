import { NextResponse } from "next/server";
import { createGoogleAuthUrl } from "@/lib/google-oauth";

export async function GET() {
  try {
    const url = createGoogleAuthUrl();
    return NextResponse.redirect(url);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Google 로그인 시작 실패";
    return NextResponse.redirect(
      new URL(
        `/?error=${encodeURIComponent(message)}`,
        process.env.APP_BASE_URL || "http://localhost:3000",
      ),
    );
  }
}
