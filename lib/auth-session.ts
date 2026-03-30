import crypto from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "mirinae_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type SessionUser = {
  email: string;
  name: string;
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
    exp: now + COOKIE_MAX_AGE,
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

/** Raw Set-Cookie header string — works everywhere, no abstraction */
export function buildSetCookieHeader(token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

export function buildClearCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** Read session from server component context */
export async function getServerSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export function getAllowedDomain() {
  return process.env.ALLOWED_DOMAIN || "mirinae.io";
}

export function isAllowedEmail(email: string) {
  return email.toLowerCase().endsWith(`@${getAllowedDomain().toLowerCase()}`);
}
