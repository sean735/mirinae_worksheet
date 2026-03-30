import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "mirinae_session";

export type SessionUser = {
  email: string;
  name: string;
  picture?: string;
  domain: string;
  iat: number;
  exp: number;
};

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET 환경변수가 필요합니다");
  }
  return secret;
}

function toBase64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf-8");
}

function sign(value: string) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

export function createSessionToken(payload: Omit<SessionUser, "iat" | "exp">) {
  const now = Math.floor(Date.now() / 1000);
  const session: SessionUser = {
    ...payload,
    iat: now,
    exp: now + 60 * 60 * 24 * 7,
  };

  const encodedPayload = toBase64Url(JSON.stringify(session));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token?: string): SessionUser | null {
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = sign(encodedPayload);
  if (signature !== expected) return null;

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as SessionUser;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getSessionUserFromRequest(
  req: NextRequest,
): SessionUser | null {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export function setSessionCookie(res: NextResponse, token: string) {
  const cookieSecure = shouldUseSecureCookie();
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie(res: NextResponse) {
  const cookieSecure = shouldUseSecureCookie();
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure,
    path: "/",
    maxAge: 0,
  });
}

function shouldUseSecureCookie() {
  const override = process.env.AUTH_COOKIE_SECURE;
  if (override) {
    return override.toLowerCase() === "true";
  }

  const baseUrl = process.env.APP_BASE_URL;
  if (baseUrl) {
    return baseUrl.startsWith("https://");
  }

  return process.env.NODE_ENV === "production";
}

export function getAllowedDomain() {
  return process.env.ALLOWED_GOOGLE_DOMAIN || "mirinae.io";
}

export function isAllowedEmail(email: string) {
  return email.toLowerCase().endsWith(`@${getAllowedDomain().toLowerCase()}`);
}
