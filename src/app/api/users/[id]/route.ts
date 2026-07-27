import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  email: z.string().email("بريد إلكتروني غير صحيح"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل").optional().or(z.literal("")),
  role: z.enum(["ADMIN", "STAFF"]),
});

/** PUT /api/users/[id] — تعديل بيانات المستخدم (Admin فقط) */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "غير مصرح لغير المدير" }, { status: 403 });
  }

  const { id } = params;
  const body = await request.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);

  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || "بيانات غير صحيحة";
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  const { name, email, password, role } = parsed.data;
  const cleanEmail = email.toLowerCase().trim();

  // فحص البريد الإلكتروني مع حسابات أخرى
  const clash = await prisma.user.findFirst({
    where: { email: cleanEmail, NOT: { id } },
  });
  if (clash) {
    return NextResponse.json(
      { error: "البريد الإلكتروني مستخدم لحساب آخر بالفعل" },
      { status: 409 }
    );
  }

  const updateData: { name: string; email: string; role: string; password?: string } = {
    name,
    email: cleanEmail,
    role,
  };

  if (password && password.trim().length >= 6) {
    updateData.password = await bcrypt.hash(password.trim(), 10);
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user: updatedUser });
}

/** DELETE /api/users/[id] — مسح حساب المستخدم (Admin فقط) */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "غير مصرح لغير المدير" }, { status: 403 });
  }

  const { id } = params;

  // منع المدير من مسح حساب نفسه
  if (session.userId === id) {
    return NextResponse.json(
      { error: "لا يمكنك مسح حسابك الحالي من اللوحة" },
      { status: 400 }
    );
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
