import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redeemSchema } from "@/lib/validation";

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = redeemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "الباركود أو الكود مطلوب" }, { status: 400 });
  }

  const { barcode, redeemedBy } = parsed.data;

  // البحث بالباركود أو الرقم القومي أو كود العائلة
  const beneficiary = await prisma.beneficiary.findFirst({
    where: {
      OR: [
        { barcode: barcode.trim() },
        { nationalId: barcode.trim() },
      ],
    },
    include: {
      family: true,
    },
  });

  if (!beneficiary) {
    return NextResponse.json(
      { error: "الباركود/الرقم القومي غير مسجل. تأكد وحاول مرة أخرى" },
      { status: 404 }
    );
  }

  if (!beneficiary.isActive) {
    return NextResponse.json(
      { error: `المستفيد "${beneficiary.fullName}" غير نشط حاليًا` },
      { status: 403 }
    );
  }

  const clientDateHeader = request.headers.get("x-client-date");
  const now = clientDateHeader ? new Date(clientDateHeader) : new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // فحص استلام الفرد نفسه
  const existingRedemption = await prisma.redemption.findUnique({
    where: {
      beneficiaryId_month_year: {
        beneficiaryId: beneficiary.id,
        month,
        year,
      },
    },
  });

  if (existingRedemption) {
    return NextResponse.json(
      {
        error: `تم الاستلام بالفعل لهذا المستفيد هذا الشهر (${ARABIC_MONTHS[month - 1]} ${year})`,
        alreadyRedeemed: true,
        beneficiary: {
          fullName: beneficiary.fullName,
          nationalId: beneficiary.nationalId,
          redeemedAt: existingRedemption.redeemedAt,
        },
      },
      { status: 409 }
    );
  }



  const bagsCount = beneficiary.family?.bagsCount ?? 1;
  const cashAmount = beneficiary.family?.cashAmount ?? 0;
  const staffName = redeemedBy || session.name || "مسؤول التوزيع";

  const redemption = await prisma.redemption.create({
    data: {
      beneficiaryId: beneficiary.id,
      familyId: beneficiary.familyId || null,
      userId: session.userId !== "env-admin" ? session.userId : null,
      month,
      year,
      bagsDelivered: bagsCount,
      cashDelivered: cashAmount,
      redeemedBy: staffName,
    },
  });

  // إذا كان الفرد من عائلة، ننشئ سجلات استلام لجميع أفراد عائلته الآخرين
  if (beneficiary.familyId) {
    const otherFamilyMembers = await prisma.beneficiary.findMany({
      where: {
        familyId: beneficiary.familyId,
        id: { not: beneficiary.id }, // ما عدا الفرد الحالي
      },
    });

    // إنشاء سجلات استلام لأفراد العائلة الآخرين الذين لم يستلموا بعد
    for (const member of otherFamilyMembers) {
      const memberRedemption = await prisma.redemption.findUnique({
        where: {
          beneficiaryId_month_year: {
            beneficiaryId: member.id,
            month,
            year,
          },
        },
      });

      // إذا لم يكن لديه سجل استلام، ننشئه الآن
      if (!memberRedemption) {
        await prisma.redemption.create({
          data: {
            beneficiaryId: member.id,
            familyId: beneficiary.familyId,
            userId: session.userId !== "env-admin" ? session.userId : null,
            month,
            year,
            bagsDelivered: bagsCount,
            cashDelivered: cashAmount,
            redeemedBy: staffName,
          },
        });
      }
    }
  }

  return NextResponse.json({
    success: true,
    beneficiary: {
      id: beneficiary.id,
      fullName: beneficiary.fullName,
      age: beneficiary.age,
      nationalId: beneficiary.nationalId,
      phone: beneficiary.phone,
      address: beneficiary.address,
      isFamilyHead: beneficiary.isFamilyHead,
      familyCode: beneficiary.family?.familyCode || null,
      familyName: beneficiary.family?.familyName || null,
      bagsDelivered: bagsCount,
      cashDelivered: cashAmount,
    },
    redemption,
    monthLabel: `${ARABIC_MONTHS[month - 1]} ${year}`,
  });
}
