import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth-session";

function getOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;

  const host = req.headers.get("host");
  if (host) return `http://${host}`;

  return process.env.APP_BASE_URL || "http://localhost:3000";
}

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", getOrigin(req)));
  clearSessionCookie(res);
  return res;
}
