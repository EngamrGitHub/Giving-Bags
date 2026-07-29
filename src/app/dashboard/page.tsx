"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  getCachedBeneficiaries,
  getPendingBeneficiaries,
  type PendingBeneficiary,
} from "@/lib/offlineDb";

import CameraScanner from "@/components/CameraScanner";

interface BeneficiaryListItem {
  id: string;
  fullName: string;
  age: number;
  nationalId: string;
  phone: string;
  barcode: string;
  isActive: boolean;
  redeemedThisMonth: boolean;
  family?: {
    familyCode: string;
    familyName: string;
  } | null;
}

interface ListResponse {
  items: BeneficiaryListItem[];
  total: number;
  page: number;
  totalPages: number;
}

const PAGE_SIZE = 5;

export default function DashboardPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | "redeemed" | "not_redeemed">("all");
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingCache, setUsingCache] = useState(false);
  const [pending, setPending] = useState<PendingBeneficiary[]>([]);
  const [showCamera, setShowCamera] = useState(false);

  const handleCameraScan = (scannedCode: string) => {
    toast.success(`تم قراءة الكود: ${scannedCode}`);
    setQuery(scannedCode);
    setPage(1);
    setShowCamera(false);
  };

  const loadFromCache = useCallback(async () => {
    const all = await getCachedBeneficiaries();
    const q = query.trim().toLowerCase();
    let filtered = q
      ? all.filter(
          (b) =>
            b.fullName.toLowerCase().includes(q) ||
            b.nationalId.includes(q) ||
            b.phone.includes(q) ||
            b.barcode.toLowerCase().includes(q)
        )
      : all;

    if (statusFilter === "redeemed") {
      filtered = filtered.filter((b) => b.redeemedThisMonth);
    } else if (statusFilter === "not_redeemed") {
      filtered = filtered.filter((b) => !b.redeemedThisMonth);
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = filtered
      .slice(start, start + PAGE_SIZE)
      .map((b) => ({
        id: b.id,
        fullName: b.fullName,
        age: b.age,
        nationalId: b.nationalId,
        phone: b.phone,
        barcode: b.barcode,
        isActive: b.isActive,
        redeemedThisMonth: b.redeemedThisMonth,
        family: b.family,
      }));

    setData({
      items: pageItems,
      total: filtered.length,
      page,
      totalPages,
    });
    setUsingCache(true);
  }, [query, page, statusFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        query,
        page: String(page),
        pageSize: String(PAGE_SIZE),
        status: statusFilter,
      });
      const res = await fetch(`/api/beneficiaries?${params.toString()}`, {
        headers: { "x-client-date": new Date().toISOString() },
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
      setUsingCache(false);
    } catch {
      // فشل الاتصال بالسيرفر — نعرض آخر نسخة محفوظة محليًا بدل ما الشاشة تفضل فاضية
      await loadFromCache();
      toast("بتعرض آخر بيانات محفوظة على الجهاز (بدون إنترنت)", { icon: "📡" });
    } finally {
      setLoading(false);
    }
  }, [query, page, statusFilter, loadFromCache]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    getPendingBeneficiaries().then(setPending);
    const timer = setInterval(() => {
      getPendingBeneficiaries().then(setPending);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  function handleSearchChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  function handleStatusFilterChange(value: "all" | "redeemed" | "not_redeemed") {
    setStatusFilter(value);
    setPage(1);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">المستفيدون</h1>
          <p className="mt-1 text-sm text-gray-500">
            {data ? `إجمالي ${data.total} مستفيد` : "جاري التحميل..."}
            {usingCache && " — (نسخة محفوظة محليًا، مفيش إنترنت دلوقتي)"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/new" className="btn-primary">
            ➕ إضافة مستفيد
          </Link>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-800">
            📡 {pending.length} مستفيد مضاف محليًا وبانتظار المزامنة مع السيرفر
          </p>
          <ul className="space-y-1">
            {pending.map((p) => (
              <li key={p.localId} className="flex items-center justify-between text-sm">
                <Link
                  href={`/dashboard/pending/${p.localId}`}
                  className="font-medium text-amber-900 hover:underline"
                >
                  {p.payload.fullName}
                </Link>
                <span
                  className={
                    p.status === "conflict" || p.status === "error"
                      ? "text-red-600"
                      : "text-amber-600"
                  }
                >
                  {p.status === "pending" && "بانتظار المزامنة"}
                  {p.status === "conflict" && "⚠️ تعارض"}
                  {p.status === "error" && "⚠️ خطأ في المزامنة"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-md min-w-[280px]">
          <input
            className="input-field w-full pl-8"
            placeholder="ابحث بالاسم، الرقم القومي، الموبايل، أو الباركود..."
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          {query && (
            <button
              type="button"
              onClick={() => handleSearchChange("")}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowCamera((p) => !p)}
          className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 flex items-center gap-1.5 transition"
        >
          📷 {showCamera ? "إغلاق الكاميرا" : "مسح QR للبحث"}
        </button>

        <select
          className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          value={statusFilter}
          onChange={(e) => handleStatusFilterChange(e.target.value as any)}
        >
          <option value="all">كل الحالات</option>
          <option value="redeemed">✅ تم الاستلام</option>
          <option value="not_redeemed">لم يستلم بعد</option>
        </select>
      </div>

      {showCamera && (
        <div className="mb-4 max-w-md">
          <CameraScanner onScanSuccess={handleCameraScan} onClose={() => setShowCamera(false)} />
        </div>
      )}

      <div className="card-surface overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-right text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">الاسم</th>
              <th className="px-4 py-3 font-medium">السن</th>
              <th className="px-4 py-3 font-medium">الرقم القومي</th>
              <th className="px-4 py-3 font-medium">الموبايل</th>
              <th className="px-4 py-3 font-medium">العائلة</th>
              <th className="px-4 py-3 font-medium">حالة الشهر الحالي</th>
              <th className="px-4 py-3 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  جاري التحميل...
                </td>
              </tr>
            )}
            {!loading && data?.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  لا يوجد مستفيدون مطابقون
                </td>
              </tr>
            )}
            {!loading &&
              data?.items.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {b.fullName}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{b.age}</td>
                  <td className="px-4 py-3 text-gray-600" dir="ltr">
                    {b.nationalId}
                  </td>
                  <td className="px-4 py-3 text-gray-600" dir="ltr">
                    {b.phone}
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-bold text-brand-700">
                    {b.family ? `${b.family.familyName} [${b.family.familyCode}]` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {b.redeemedThisMonth ? (
                      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                        ✅ تم الاستلام
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                        لم يستلم بعد
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/${b.id}`}
                      className="text-sm font-medium text-brand-700 hover:underline"
                    >
                      عرض البيانات
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            السابق
          </button>
          <span className="text-sm text-gray-500">
            صفحة {data.page} من {data.totalPages}
          </span>
          <button
            className="btn-secondary"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
