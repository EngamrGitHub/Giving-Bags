import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  email: z.string().email("بريد إلكتروني غير صحيح").optional(),
  username: z
    .string()
    .min(3, "اسم المستخدم مطلوب (3 حروف على الأقل)")
    .regex(/^[a-zA-Z0-9_]+$/, "اسم المستخدم يجب أن يحتوي على حروف إنجليزية وأرقام و _ فقط")
    .optional(),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل").optional().or(z.literal("")),
  role: z.enum(["ADMIN", "STAFF"]),
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

  const { name, email, username, password, role } = parsed.data;
  const cleanEmail = email?.trim() ? email.toLowerCase().trim() : undefined;
  const cleanUsername = username?.trim() ? username.trim().toLowerCase() : undefined;

  const clash = await prisma.user.findFirst({
    where: {
      OR: [
        ...(cleanEmail ? [{ email: cleanEmail }] : []),
        ...(cleanUsername ? [{ username: cleanUsername }] : []),
      ],
      NOT: { id },
    },
  });
  if (clash) {
    return NextResponse.json(
      { error: "البريد الإلكتروني أو اسم المستخدم مستخدم لحساب آخر بالفعل" },
      { status: 409 }
    );
  }

  const updateData: {
    name: string;
    role: string;
    email?: string | null;
    username?: string | null;
    password?: string;
  } = {
    name,
    role,
  };

  if (cleanEmail !== undefined) {
    updateData.email = cleanEmail;
  }

  if (cleanUsername !== undefined) {
    updateData.username = cleanUsername;
  }


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
