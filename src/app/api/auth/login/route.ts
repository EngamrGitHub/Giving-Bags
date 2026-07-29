import { NextRequest, NextResponse } from "next/server";
import { createSession, authenticateUser } from "@/lib/auth";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().min(1, "اسم المستخدم أو البريد المطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "من فضلك أدخل البريد الإلكتروني/اسم المستخدم وكلمة المرور" },
        { status: 400 }
      );
    }

    const { username, password } = parsed.data;

    const sessionPayload = await authenticateUser(username, password);
    if (!sessionPayload) {
      return NextResponse.json(
        { error: "البريد الإلكتروني/اسم المستخدم أو كلمة المرور غير صحيحة" },
        { status: 401 }
      );
    }

    await createSession(sessionPayload);
    return NextResponse.json({ success: true, user: sessionPayload });
  } catch (err: any) {
    console.error("Login API route error:", err);
    return NextResponse.json(
      { error: `خطأ في سيرفر الجلسات: ${err?.message || String(err)}` },
      { status: 500 }
    );
  }
}
