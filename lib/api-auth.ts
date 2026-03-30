import { NextRequest } from "next/server";
import {
  getSessionUserFromRequest,
  type SessionUser,
} from "@/lib/auth-session";

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export function requireSessionUser(req: NextRequest): SessionUser {
  const session = getSessionUserFromRequest(req);
  if (!session) {
    throw new AuthError("로그인이 필요합니다", 401);
  }
  return session;
}
