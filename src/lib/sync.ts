import {
  getPendingRedemptions,
  getPendingBeneficiaries,
  removePendingRedemption,
  removePendingBeneficiary,
  updatePendingRedemption,
  updatePendingBeneficiary,
  markCachedAsRedeemed,
  upsertCachedBeneficiary,
  replaceBeneficiaryCache,
  findCachedByBarcode,
  currentMonthKey,
} from "./offlineDb";

export interface SyncSummary {
  syncedBeneficiaries: number;
  syncedRedemptions: number;
  conflicts: number;
  errors: number;
  networkUnavailable: boolean;
  barcodesChanged: number;
}

/** يحاول مزامنة كل العناصر المعلّقة (مستفيدين + تسليمات) مع السيرفر */
export async function syncPendingData(): Promise<SyncSummary> {
  const summary: SyncSummary = {
    syncedBeneficiaries: 0,
    syncedRedemptions: 0,
    conflicts: 0,
    errors: 0,
    networkUnavailable: false,
    barcodesChanged: 0,
  };

  if (typeof window === "undefined" || !navigator.onLine) {
    summary.networkUnavailable = true;
    return summary;
  }

  // 1) مزامنة المستفيدين اللي اتضافوا أوفلاين أولًا
  const pendingBeneficiaries = await getPendingBeneficiaries();
  for (const entry of pendingBeneficiaries) {
    if (entry.status !== "pending") continue;
    try {
      const res = await fetch("/api/beneficiaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...entry.payload, barcode: entry.localBarcode }),
      });

      if (res.status === 401) {
        summary.networkUnavailable = true; // نعتبرها متوقفة لحد ما يسجل دخول تاني
        break;
      }

      const data = await res.json();

      if (res.ok) {
        await removePendingBeneficiary(entry.localId);
        await upsertCachedBeneficiary({
          id: data.item.id,
          fullName: data.item.fullName,
          age: data.item.age,
          nationalId: data.item.nationalId,
          phone: data.item.phone,
          address: data.item.address,
          barcode: data.item.barcode,
          isActive: data.item.isActive,
          redeemedThisMonth: false,
          redeemedMonthKey: currentMonthKey(),
        });
        summary.syncedBeneficiaries++;
        if (data.barcodeChanged) summary.barcodesChanged++;
      } else if (res.status === 409) {
        await updatePendingBeneficiary({
          ...entry,
          status: "conflict",
          message: data.error || "يوجد مستفيد بنفس الرقم القومي بالفعل",
        });
        summary.conflicts++;
      } else {
        await updatePendingBeneficiary({
          ...entry,
          status: "error",
          message: data.error || "تعذرت إضافة المستفيد",
        });
        summary.errors++;
      }
    } catch {
      // فشل في الشبكة نفسها أثناء المزامنة — نوقف ونحاول تاني بعدين
      summary.networkUnavailable = true;
      return summary;
    }
  }

  // 2) مزامنة عمليات تسليم الشنط
  const pendingRedemptions = await getPendingRedemptions();
  for (const entry of pendingRedemptions) {
    if (entry.status !== "pending") continue;
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: entry.barcode,
          redeemedBy: entry.redeemedBy,
        }),
      });

      if (res.status === 401) {
        summary.networkUnavailable = true;
        break;
      }

      const data = await res.json();

      if (res.ok) {
        await removePendingRedemption(entry.localId);
        const cached = await findCachedByBarcode(entry.barcode);
        if (cached) await markCachedAsRedeemed(cached.id);
        summary.syncedRedemptions++;
      } else if (res.status === 409) {
        await updatePendingRedemption({
          ...entry,
          status: "conflict",
          message: data.error || "تم تسليم الشنطة لهذا الشخص بالفعل هذا الشهر",
        });
        summary.conflicts++;
      } else {
        await updatePendingRedemption({
          ...entry,
          status: "error",
          message: data.error || "تعذر تسجيل عملية التسليم",
        });
        summary.errors++;
      }
    } catch {
      summary.networkUnavailable = true;
      return summary;
    }
  }

  return summary;
}

/** يجلب أحدث نسخة من بيانات المستفيدين من السيرفر ويحدّث الكاش المحلي */
export async function refreshBeneficiaryCache(): Promise<boolean> {
  if (typeof window === "undefined" || !navigator.onLine) return false;
  try {
    const res = await fetch("/api/beneficiaries/export-cache", {
      headers: { "x-client-date": new Date().toISOString() },
    });
    if (!res.ok) return false;
    const data = await res.json();
    await replaceBeneficiaryCache(data.items);
    return true;
  } catch {
    return false;
  }
}
