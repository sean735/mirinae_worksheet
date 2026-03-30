import bcrypt from "bcryptjs";
import { getDb } from "@/lib/mongodb";
import { getAllowedDomain, isAllowedEmail } from "@/lib/auth-session";

type DbCredential = {
  _id: string; // email
  passwordHash: string;
  createdAt: Date;
};

export async function signup(email: string, name: string, password: string) {
  email = email.toLowerCase().trim();

  if (!isAllowedEmail(email)) {
    throw new Error(
      `@${getAllowedDomain()} 이메일만 가입할 수 있습니다`,
    );
  }

  if (password.length < 8) {
    throw new Error("비밀번호는 8자 이상이어야 합니다");
  }

  const db = await getDb();
  const credentials = db.collection<DbCredential>("credentials");

  const existing = await credentials.findOne({ _id: email });
  if (existing) {
    throw new Error("이미 가입된 이메일입니다");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await credentials.insertOne({
    _id: email,
    passwordHash,
    createdAt: new Date(),
  });

  return { email, name };
}

export async function login(email: string, password: string) {
  email = email.toLowerCase().trim();

  const db = await getDb();
  const credentials = db.collection<DbCredential>("credentials");
  const credential = await credentials.findOne({ _id: email });

  if (!credential) {
    throw new Error("이메일 또는 비밀번호가 올바르지 않습니다");
  }

  const valid = await bcrypt.compare(password, credential.passwordHash);
  if (!valid) {
    throw new Error("이메일 또는 비밀번호가 올바르지 않습니다");
  }

  return { email };
}
