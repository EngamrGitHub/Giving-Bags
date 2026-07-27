import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * يرجّع كل المستفيدين (بدون صفحات) بحقول مختصرة، تستخدمها الواجهة
 * لتحديث الكاش المحلي (IndexedDB) عشان صفحة "تسليم شنطة" و"المستفيدون"
 * تشتغل حتى لو النت اتقطع بعد كده.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const clientDateHeader = request.headers.get("x-client-date");
  const now = clientDateHeader ? new Date(clientDateHeader) : new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const beneficiaries = await prisma.beneficiary.findMany({
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      age: true,
      nationalId: true,
      phone: true,
      address: true,
      barcode: true,
      isActive: true,
      redemptions: {
        where: { month, year },
        select: { id: true },
        take: 1,
      },
    },
  });

  const monthKey = `${year}-${month}`;

  return NextResponse.json({
    monthKey,
    items: beneficiaries.map((b) => ({
      id: b.id,
      fullName: b.fullName,
      age: b.age,
      nationalId: b.nationalId,
      phone: b.phone,
      address: b.address,
      barcode: b.barcode,
      isActive: b.isActive,
      redeemedThisMonth: b.redemptions.length > 0,
      redeemedMonthKey: monthKey,
    })),
  });
}
