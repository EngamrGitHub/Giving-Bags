import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createUserSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب (حرفين على الأقل)"),
  email: z.string().email("بريد إلكتروني غير صحيح"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
  role: z.enum(["ADMIN", "STAFF"]).default("STAFF"),
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

  const { name, email, password, role } = parsed.data;
  const cleanEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({
    where: { email: cleanEmail },
  });

  if (existing) {
    return NextResponse.json(
      { error: "يوجد حساب مسجل بهذا البريد الإلكتروني بالفعل" },
      { status: 409 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await prisma.user.create({
    data: {
      name,
      email: cleanEmail,
      password: hashedPassword,
      role,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user: newUser }, { status: 201 });
}
