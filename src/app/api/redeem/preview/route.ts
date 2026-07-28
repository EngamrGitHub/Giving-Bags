import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

/** GET /api/redeem/preview?barcode=XXX — معاينة بيانات المستفيد بدون تسجيل استلام */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const barcode = new URL(request.url).searchParams.get("barcode")?.trim();
  if (!barcode) {
    return NextResponse.json({ error: "الباركود مطلوب" }, { status: 400 });
  }

  const beneficiary = await prisma.beneficiary.findFirst({
    where: {
      OR: [{ barcode }, { nationalId: barcode }],
    },
    include: { family: true },
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

  const existingRedemption = await prisma.redemption.findUnique({
    where: {
      beneficiaryId_month_year: { beneficiaryId: beneficiary.id, month, year },
    },
  });

  const bagsCount = beneficiary.family?.bagsCount ?? 1;
  const cashAmount = beneficiary.family?.cashAmount ?? 0;

  return NextResponse.json({
    beneficiary: {
      id: beneficiary.id,
      fullName: beneficiary.fullName,
      age: beneficiary.age,
      nationalId: beneficiary.nationalId,
      phone: beneficiary.phone,
      address: beneficiary.address,
      barcode: beneficiary.barcode,
      isFamilyHead: beneficiary.isFamilyHead,
      familyCode: beneficiary.family?.familyCode || null,
      familyName: beneficiary.family?.familyName || null,
      bagsCount,
      cashAmount,
    },
    alreadyRedeemed: !!existingRedemption,
    redeemedAt: existingRedemption?.redeemedAt || null,
    monthLabel: `${ARABIC_MONTHS[month - 1]} ${year}`,
  });
}
