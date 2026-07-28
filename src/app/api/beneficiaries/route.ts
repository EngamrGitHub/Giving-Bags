import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { beneficiarySchema } from "@/lib/validation";
import { generateBarcodeValue } from "@/lib/barcode";
import { Prisma } from "@prisma/client";

/** GET /api/beneficiaries?query=...&page=1&pageSize=20 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() || "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get("pageSize")) || 20)
  );
  const status = searchParams.get("status") || "all";

  const clientDateHeader = request.headers.get("x-client-date");
  const now = clientDateHeader ? new Date(clientDateHeader) : new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const where: Prisma.BeneficiaryWhereInput = {};

  if (query) {
    where.OR = [
      { fullName: { contains: query } },
      { nationalId: { contains: query } },
      { phone: { contains: query } },
      { barcode: { contains: query } },
    ];
  }

  if (status === "redeemed") {
    where.redemptions = {
      some: { month, year },
    };
  } else if (status === "not_redeemed") {
    where.redemptions = {
      none: { month, year },
    };
  }

  const [items, total] = await Promise.all([
    prisma.beneficiary.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        family: {
          select: {
            id: true,
            familyCode: true,
            familyName: true,
            bagsCount: true,
            cashAmount: true,
          },
        },
        redemptions: {
          where: { month, year },
          take: 1,
        },
      },
    }),
    prisma.beneficiary.count({ where }),
  ]);

  return NextResponse.json({
    items: items.map((b) => ({
      ...b,
      redeemedThisMonth: b.redemptions.length > 0,
      redemptions: undefined,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

/** POST /api/beneficiaries — إضافة مستفيد جديد */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = beneficiarySchema.safeParse(body);

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || "بيانات غير صحيحة";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const data = parsed.data;

  const existing = await prisma.beneficiary.findUnique({
    where: { nationalId: data.nationalId },
  });
  if (existing) {
    return NextResponse.json(
      { error: "يوجد مستفيد مسجل بنفس الرقم القومي بالفعل" },
      { status: 409 }
    );
  }

  // لو الطلب جاي من مزامنة مستفيد اتضاف أوفلاين، نحافظ على نفس الباركود
  // اللي كان متطبوع على الكارت أول ما اتضاف، طالما لسه متاح
  let barcode = data.barcode;
  let barcodeChanged = false;
  if (barcode) {
    const clash = await prisma.beneficiary.findUnique({ where: { barcode } });
    if (clash) {
      barcode = undefined;
      barcodeChanged = true;
    }
  }
  if (!barcode) {
    barcode = generateBarcodeValue();
    for (let attempts = 0; attempts < 5; attempts++) {
      const clash = await prisma.beneficiary.findUnique({ where: { barcode } });
      if (!clash) break;
      barcode = generateBarcodeValue();
    }
  }

  const beneficiary = await prisma.beneficiary.create({
    data: {
      fullName: data.fullName,
      age: data.age,
      nationalId: data.nationalId,
      phone: data.phone,
      address: data.address || "غير مدون",
      notes: data.notes || null,
      familyId: data.familyId || null,
      isFamilyHead: data.isFamilyHead || false,
      documentsProvided: data.documentsProvided ?? false,
      barcode,
    },
    include: {
      family: true,
    },
  });

  return NextResponse.json(
    { item: beneficiary, barcodeChanged },
    { status: 201 }
  );
}
