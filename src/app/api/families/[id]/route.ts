import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const updateFamilySchema = z.object({
  familyCode: z.string().min(2, "كود العائلة مطلوب"),
  familyName: z.string().min(2, "اسم العائلة مطلوب"),
  bagsCount: z.coerce.number().min(0, "عدد الشنط يجب أن يكون 0 أو أكثر"),
  cashAmount: z.coerce.number().min(0, "المبلغ المالي يجب أن يكون 0 أو أكثر"),
  notes: z.string().optional(),
});

/** PUT /api/families/[id] — تعديل بيانات ومخصصات العائلة */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = params;
  const body = await request.json().catch(() => null);
  const parsed = updateFamilySchema.safeParse(body);

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || "بيانات غير صحيحة";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { familyCode, familyName, bagsCount, cashAmount, notes } = parsed.data;

  // التأكد من عدم تكرار كود العائلة لعائلة أخرى
  const clash = await prisma.family.findFirst({
    where: { familyCode, NOT: { id } },
  });
  if (clash) {
    return NextResponse.json(
      { error: "كود العائلة مستخدم لعائلة أخرى بالفعل" },
      { status: 409 }
    );
  }

  const family = await prisma.family.update({
    where: { id },
    data: {
      familyCode,
      familyName,
      bagsCount,
      cashAmount,
      notes: notes || null,
    },
  });

  return NextResponse.json({ family });
}

/** DELETE /api/families/[id] — مسح العائلة */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = params;
  await prisma.family.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
