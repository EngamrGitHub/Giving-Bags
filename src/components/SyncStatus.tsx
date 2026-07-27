"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getPendingCount } from "@/lib/offlineDb";
import { syncPendingData, refreshBeneficiaryCache } from "@/lib/sync";

const SYNC_INTERVAL_MS = 20_000; // إعادة محاولة المزامنة كل 20 ثانية لو فيه عناصر معلّقة
const CACHE_REFRESH_INTERVAL_MS = 2 * 60_000; // تحديث الكاش المحلي كل دقيقتين وقت الاتصال

export default function SyncStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      // IndexedDB غير متاح (نادر) — نتجاهل بصمت
    }
  }, []);

  const runSync = useCallback(
    async (silent = true) => {
      if (!navigator.onLine) return;
      setSyncing(true);
      try {
        const summary = await syncPendingData();
        await refreshPendingCount();
        if (!silent) {
          if (summary.networkUnavailable) {
            toast.error("مفيش اتصال بالسيرفر دلوقتي، هيتم إعادة المحاولة تلقائيًا");
          } else if (
            summary.syncedBeneficiaries + summary.syncedRedemptions >
            0
          ) {
            toast.success(
              `تمت مزامنة ${summary.syncedBeneficiaries + summary.syncedRedemptions} عنصر بنجاح`
            );
            if (summary.barcodesChanged > 0) {
              toast.error(
                `تنبيه: ${summary.barcodesChanged} كارت اتغيّر الباركود بتاعه بعد المزامنة (كان مستخدم قبل كده) — لازم تطبعه تاني`,
                { duration: 8000 }
              );
            }
          } else if (summary.conflicts > 0) {
            toast.error(`${summary.conflicts} عنصر فيه تعارض، راجعه يدويًا`);
          } else {
            toast.success("كل البيانات متزامنة بالفعل");
          }
        }
      } finally {
        setSyncing(false);
      }
    },
    [refreshPendingCount]
  );

  useEffect(() => {
    setIsOnline(navigator.onLine);
    refreshPendingCount();

    function handleOnline() {
      setIsOnline(true);
      toast.success("رجع الاتصال بالإنترنت — جاري مزامنة البيانات...");
      runSync(true);
      refreshBeneficiaryCache();
    }
    function handleOffline() {
      setIsOnline(false);
      toast("تم قطع الاتصال بالإنترنت — البيانات هتتسجل محليًا لحد ما يرجع النت", {
        icon: "📡",
      });
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // أول تحميل: لو متصل، حدّث الكاش وحاول تزامن أي حاجة معلّقة من قبل
    if (navigator.onLine) {
      refreshBeneficiaryCache();
      runSync(true);
    }

    const syncTimer = setInterval(() => {
      if (navigator.onLine) runSync(true);
    }, SYNC_INTERVAL_MS);

    const cacheTimer = setInterval(() => {
      if (navigator.onLine) refreshBeneficiaryCache();
    }, CACHE_REFRESH_INTERVAL_MS);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(syncTimer);
      clearInterval(cacheTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
          isOnline
            ? "bg-brand-50 text-brand-700"
            : "bg-amber-50 text-amber-700"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            isOnline ? "bg-brand-500" : "bg-amber-500"
          }`}
        />
        {isOnline ? "متصل" : "غير متصل"}
      </span>

      {pendingCount > 0 && (
        <button
          onClick={() => runSync(false)}
          disabled={syncing || !isOnline}
          className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 transition hover:bg-amber-200 disabled:opacity-60"
          title="اضغط لمحاولة المزامنة الآن"
        >
          🔄 {syncing ? "جاري المزامنة..." : `${pendingCount} بانتظار المزامنة`}
        </button>
      )}
    </div>
  );
}
