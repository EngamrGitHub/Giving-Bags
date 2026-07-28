import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createUserSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب (حرفين على الأقل)"),
  email: z.string().email("بريد إلكتروني غير صحيح").optional(),
  username: z
    .string()
    .min(3, "اسم المستخدم مطلوب (3 حروف على الأقل)")
    .regex(/^[a-zA-Z0-9_]+$/, "اسم المستخدم يجب أن يحتوي على حروف إنجليزية وأرقام و _ فقط")
    .optional(),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
  role: z.enum(["ADMIN", "STAFF"]).default("STAFF"),
}).superRefine((data, ctx) => {
  if (data.role === "ADMIN") {
    if (!data.email) {
      ctx.addIssue({
        path: ["email"],
        code: z.ZodIssueCode.custom,
        message: "البريد الإلكتروني مطلوب لحساب المدير",
      });
    }
  } else {
    if (!data.username) {
      ctx.addIssue({
        path: ["username"],
        code: z.ZodIssueCode.custom,
        message: "اسم المستخدم مطلوب لحساب الموظف",
      });
    }
  }
});

/** GET /api/users - عرض كافة الحسابات (Admin فقط) */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "غير مصرح لغير المدير" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users });
}

/** POST /api/users - إنشاء حساب جديد (Admin فقط) */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "غير مصرح لغير المدير" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || "بيانات غير صحيحة";
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  const { name, email, username, password, role } = parsed.data;
  const cleanEmail = email?.trim() ? email.toLowerCase().trim() : null;
  const cleanUsername = username?.trim() ? username.trim().toLowerCase() : null;

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        ...(cleanEmail ? [{ email: cleanEmail }] : []),
        ...(cleanUsername ? [{ username: cleanUsername }] : []),
      ],
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "يوجد حساب مسجل بالفعل بهذا البريد الإلكتروني أو اسم المستخدم" },
      { status: 409 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await prisma.user.create({
    data: {
      name,
      email: cleanEmail,
      username: cleanUsername,
      password: hashedPassword,
      role,
    },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user: newUser }, { status: 201 });
}
