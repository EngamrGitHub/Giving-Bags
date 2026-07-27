import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const createFamilySchema = z.object({
  familyCode: z.string().min(2, "كود العائلة مطلوب"),
  familyName: z.string().min(2, "اسم العائلة مطلوب"),
  bagsCount: z.coerce.number().min(0, "عدد الشنط يجب أن يكون 0 أو أكثر").default(1),
  cashAmount: z.coerce.number().min(0, "المبلغ المالي يجب أن يكون 0 أو أكثر").default(0),
  notes: z.string().optional(),
});

/** GET /api/families — قائمة العائلات بالمخصصات وأفراد كل عائلة */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() || "";

  const clientDateHeader = request.headers.get("x-client-date");
  const now = clientDateHeader ? new Date(clientDateHeader) : new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const families = await prisma.family.findMany({
    where: query
      ? {
          OR: [
            { familyName: { contains: query } },
            { familyCode: { contains: query } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    include: {
      beneficiaries: {
        select: {
          id: true,
          fullName: true,
          nationalId: true,
          phone: true,
          barcode: true,
          isFamilyHead: true,
        },
      },
      redemptions: {
        where: { month, year },
        take: 1,
        include: {
          beneficiary: {
            select: { fullName: true },
          },
        },
      },
    },
  });

  return NextResponse.json({
    families: families.map((f) => ({
      ...f,
      redeemedThisMonth: f.redemptions.length > 0,
      redeemedByMember: f.redemptions[0]?.beneficiary?.fullName || null,
      redeemedAt: f.redemptions[0]?.redeemedAt || null,
    })),
  });
}

/** POST /api/families — إنشاء عائلة جديدة بكود ومخصصات (شنط / مبالغ) */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createFamilySchema.safeParse(body);

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || "بيانات غير صحيحة";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { familyCode, familyName, bagsCount, cashAmount, notes } = parsed.data;

  const existing = await prisma.family.findUnique({
    where: { familyCode },
  });

  if (existing) {
    return NextResponse.json(
      { error: "يوجد عائلة مسجلة بنفس الكود المميز بالفعل" },
      { status: 409 }
    );
  }

  const family = await prisma.family.create({
    data: {
      familyCode,
      familyName,
      bagsCount,
      cashAmount,
      notes: notes || null,
    },
  });

  return NextResponse.json({ family }, { status: 201 });
}
