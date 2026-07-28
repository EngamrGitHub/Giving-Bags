import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { beneficiarySchema } from "@/lib/validation";

interface Params {
  params: { id: string };
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const beneficiary = await prisma.beneficiary.findUnique({
    where: { id: params.id },
    include: {
      family: true,
      redemptions: { orderBy: { redeemedAt: "desc" }, take: 12 },
    },
  });

  if (!beneficiary) {
    return NextResponse.json({ error: "المستفيد غير موجود" }, { status: 404 });
  }

  return NextResponse.json({ item: beneficiary });
}

export async function PUT(request: NextRequest, { params }: Params) {
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

  const duplicate = await prisma.beneficiary.findFirst({
    where: { nationalId: data.nationalId, NOT: { id: params.id } },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "يوجد مستفيد آخر مسجل بنفس الرقم القومي" },
      { status: 409 }
    );
  }

  try {
    const beneficiary = await prisma.beneficiary.update({
      where: { id: params.id },
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
      },
      include: {
        family: true,
      },
    });
    return NextResponse.json({ item: beneficiary });
  } catch {
    return NextResponse.json({ error: "المستفيد غير موجود" }, { status: 404 });
  }
}

/** PATCH /api/beneficiaries/[id] — إزالة المستفيد من عائلته */
export async function PATCH(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const beneficiary = await prisma.beneficiary.update({
      where: { id: params.id },
      data: { familyId: null, isFamilyHead: false },
    });
    return NextResponse.json({ item: beneficiary });
  } catch {
    return NextResponse.json({ error: "المستفيد غير موجود" }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    await prisma.beneficiary.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "المستفيد غير موجود" }, { status: 404 });
  }
}
