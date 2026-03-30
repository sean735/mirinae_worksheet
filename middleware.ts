import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "mirinae_session";

const protectedPaths = ["/dashboard", "/leave", "/status", "/calendar"];

function getOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;

  const host = req.headers.get("host");
  if (host) return `http://${host}`;

  return process.env.APP_BASE_URL || "http://localhost:3000";
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

  if (!isProtected) {
    return NextResponse.next();
  }

  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (hasSession) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/", getOrigin(req));
  loginUrl.searchParams.set("error", "로그인이 필요합니다");
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/leave/:path*",
    "/status/:path*",
    "/calendar/:path*",
  ],
};
