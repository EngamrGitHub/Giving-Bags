"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  getCachedBeneficiaries,
  getPendingBeneficiaries,
  type PendingBeneficiary,
} from "@/lib/offlineDb";

interface BeneficiaryListItem {
  id: string;
  fullName: string;
  age: number;
  nationalId: string;
  phone: string;
  barcode: string;
  isActive: boolean;
  redeemedThisMonth: boolean;
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
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingCache, setUsingCache] = useState(false);
  const [pending, setPending] = useState<PendingBeneficiary[]>([]);

  const loadFromCache = useCallback(async () => {
    const all = await getCachedBeneficiaries();
    const q = query.trim().toLowerCase();
    const filtered = q
      ? all.filter(
          (b) =>
            b.fullName.toLowerCase().includes(q) ||
            b.nationalId.includes(q) ||
            b.phone.includes(q) ||
            b.barcode.toLowerCase().includes(q)
        )
      : all;

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
      }));

    setData({
      items: pageItems,
      total: filtered.length,
      page,
      totalPages,
    });
    setUsingCache(true);
  }, [query, page]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        query,
        page: String(page),
        pageSize: String(PAGE_SIZE),
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
  }, [query, page, loadFromCache]);

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
          <Link href="/dashboard/cards" className="btn-secondary">
            🖨️ طباعة كل الكروت
          </Link>
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
                  {p.status === "pending" && "⏳ بانتظار المزامنة"}
                  {p.status === "conflict" && "⚠️ تعارض"}
                  {p.status === "error" && "⚠️ خطأ في المزامنة"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4">
        <input
          className="input-field max-w-md"
          placeholder="ابحث بالاسم، الرقم القومي، الموبايل، أو الباركود..."
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      <div className="card-surface overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-right text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">الاسم</th>
              <th className="px-4 py-3 font-medium">السن</th>
              <th className="px-4 py-3 font-medium">الرقم القومي</th>
              <th className="px-4 py-3 font-medium">الموبايل</th>
              <th className="px-4 py-3 font-medium">حالة الشهر الحالي</th>
              <th className="px-4 py-3 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  جاري التحميل...
                </td>
              </tr>
            )}
            {!loading && data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
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
                  <td className="px-4 py-3">
                    {b.redeemedThisMonth ? (
                      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                        ✅ تم الاستلام
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                        ⏳ لم يستلم بعد
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/${b.id}`}
                      className="text-sm font-medium text-brand-700 hover:underline"
                    >
                      عرض الكارت
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
