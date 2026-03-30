import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "mirinae_session";

const protectedPaths = ["/dashboard", "/leave", "/status", "/calendar"];

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

  const loginUrl = new URL("/", req.url);
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
