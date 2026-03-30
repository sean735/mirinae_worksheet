import { NextRequest, NextResponse } from "next/server";
import { buildClearCookieHeader } from "@/lib/auth-session";

function getOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;

  const host = req.headers.get("host");
  if (host && !host.includes(":3000")) return `https://${host}`;

  return process.env.APP_BASE_URL || "http://localhost:3000";
}

export async function GET(req: NextRequest) {
  const redirectUrl = new URL("/", getOrigin(req)).toString();

  return new NextResponse(
    `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${redirectUrl}"></head><body></body></html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html",
        "Set-Cookie": buildClearCookieHeader(),
      },
    },
  );
}
