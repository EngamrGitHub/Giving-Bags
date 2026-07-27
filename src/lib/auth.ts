import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

const COOKIE_NAME = "session";
const SESSION_DURATION = 60 * 60 * 8; // 8 ساعات

function getSecretKey() {
  const secret = process.env.JWT_SECRET || "super-secret-jwt-key-for-bags-distribution-app-2026";
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: "ADMIN" | "STAFF";
  [key: string]: unknown;
}

/** التحقق من حساب المستخدم من قاعدة البيانات أو البيئة (.env) */
export async function authenticateUser(identifier: string, password: string): Promise<SessionPayload | null> {
  const cleanId = identifier.trim().toLowerCase();

  // 1. البحث في جدول المستخدمين في قاعدة البيانات
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: cleanId }, { email: identifier }],
    },
  });

  if (user) {
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      return {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role as "ADMIN" | "STAFF",
      };
    }
    return null;
  }

  // 2. Fallback: التحقق مقابل بيانات ADMIN في ملف .env
  const envUser = process.env.ADMIN_USERNAME || "admin";
  const envPass = process.env.ADMIN_PASSWORD || "admin123";
  if ((cleanId === envUser.toLowerCase() || cleanId === "admin@ellwaa.org") && password === envPass) {
    return {
      userId: "env-admin",
      email: "admin@ellwaa.org",
      name: "مدير النظام",
      role: "ADMIN",
    };
  }

  return null;
}

/** إنشاء توكن جلسة موقّع ووضعه في كوكي HttpOnly */
export async function createSession(userPayload: SessionPayload) {
  const token = await new SignJWT({ ...userPayload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecretKey());

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
}

export function destroySession() {
  cookies().delete(COOKIE_NAME);
}

/** قراءة والتحقق من جلسة المستخدم الحالية من الكوكيز */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** نفس التحقق لكن باستخدام كوكيز مأخوذة يدويًا */
export async function verifySessionToken(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export { COOKIE_NAME };
