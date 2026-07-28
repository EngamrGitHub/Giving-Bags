"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

interface BeneficiaryMember {
  id: string;
  fullName: string;
  nationalId: string;
  phone: string;
  isFamilyHead: boolean;
}

interface FamilyItem {
  id: string;
  familyCode: string;
  familyName: string;
  bagsCount: number;
  cashAmount: number;
  notes?: string;
  beneficiaries: BeneficiaryMember[];
  redeemedThisMonth: boolean;
  redeemedByMember?: string | null;
  redeemedAt?: string | null;
}

export default function FamiliesPage() {
  const [families, setFamilies] = useState<FamilyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingFamily, setEditingFamily] = useState<FamilyItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Form states
  const [familyCode, setFamilyCode] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [bagsCount, setBagsCount] = useState(1);
  const [cashAmount, setCashAmount] = useState(0);
  const [notes, setNotes] = useState("");

  async function fetchFamilies(query = "", currentPage = page) {
    setLoading(true);
    try {
      const res = await fetch(`/api/families?query=${encodeURIComponent(query)}&page=${currentPage}&pageSize=5`, {
        headers: { "x-client-date": new Date().toISOString() },
      });
      const data = await res.json();
      if (res.ok) {
        setFamilies(data.families || []);
        setTotalPages(data.totalPages || 1);
      } else {
        toast.error(data.error || "فشل جلب العائلات");
      }
    } catch {
      toast.error("تعذر الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFamilies(search, page);
  }, [page]);

  function openCreateModal() {
    setEditingFamily(null);
    setFamilyCode(`FAM-${Math.floor(10000 + Math.random() * 90000)}`);
    setFamilyName("");
    setBagsCount(1);
    setCashAmount(0);
    setNotes("");
    setShowModal(true);
  }

  function openEditModal(f: FamilyItem) {
    setEditingFamily(f);
    setFamilyCode(f.familyCode);
    setFamilyName(f.familyName);
    setBagsCount(f.bagsCount);
    setCashAmount(f.cashAmount);
    setNotes(f.notes || "");
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload = { familyCode, familyName, bagsCount, cashAmount, notes };
    const url = editingFamily ? `/api/families/${editingFamily.id}` : "/api/families";
    const method = editingFamily ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "فشل الحفظ");
      } else {
        toast.success(editingFamily ? "تم تعديل بيانات العائلة" : "تمت إضافة العائلة بنجاح");
        setShowModal(false);
        fetchFamilies(search, page);
      }
    } catch {
      toast.error("حدث خطأ أثناء الاتصال");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeMember(memberId: string, memberName: string) {
    if (!confirm(`هل تريد إزالة "${memberName}" من العائلة؟\n(سيظل مسجلاً في النظام بدون عائلة)`)) return;
    setRemovingMemberId(memberId);
    try {
      const res = await fetch(`/api/beneficiaries/${memberId}`, { method: "PATCH" });
      if (res.ok) {
        toast.success(`تمت إزالة ${memberName} من العائلة`);
        // تحديث البيانات في الـ state مباشرة
        setEditingFamily((prev) =>
          prev
            ? { ...prev, beneficiaries: prev.beneficiaries.filter((b) => b.id !== memberId) }
            : prev
        );
        setFamilies((prev) =>
          prev.map((f) =>
            f.id === editingFamily?.id
              ? { ...f, beneficiaries: f.beneficiaries.filter((b) => b.id !== memberId) }
              : f
          )
        );
      } else {
        const data = await res.json();
        toast.error(data.error || "فشل إزالة الفرد");
      }
    } catch {
      toast.error("خطأ في الاتصال");
    } finally {
      setRemovingMemberId(null);
    }
  }

  async function handleDelete(f: FamilyItem) {
    if (!confirm(`هل أنت تأكد من مسح عائلة "${f.familyName}"؟`)) return;

    try {
      const res = await fetch(`/api/families/${f.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("تم مسح العائلة");
        fetchFamilies(search, page);
      } else {
        toast.error("فشل مسح العائلة");
      }
    } catch {
      toast.error("خطأ في الاتصال");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">إدارة العائلات وتخصيص المساعدات</h1>
          <p className="mt-1 text-sm text-gray-500">
            تمييز كل عائلة برقم فريد، وتحديد مخصصاتها من الشنط والمبالغ المالية
          </p>
        </div>
        <button onClick={openCreateModal} className="btn-primary">
          إضافة عائلة جديدة
        </button>
      </div>

      {/* البحث */}
      <div className="card-surface p-4">
        <input
          type="text"
          className="input-field"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
            fetchFamilies(e.target.value, 1);
          }}
          placeholder="ابحث باسم العائلة أو كود العائلة المميز..."
        />
      </div>

      {/* Modal إضافة وتعديل عائلة */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">
                {editingFamily ? "تعديل مخصصات العائلة" : "إضافة عائلة جديدة"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">كود العائلة المميز</label>
                  <input
                    type="text"
                    required
                    className="input-field text-center font-mono font-bold"
                    dir="ltr"
                    value={familyCode}
                    onChange={(e) => setFamilyCode(e.target.value)}
                    placeholder="FAM-1001"
                  />
                </div>
                <div>
                  <label className="label-field">اسم العائلة</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    placeholder="مثال: عائلة آل محمود"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">عدد الشنط المخصصة</label>
                  <input
                    type="number"
                    min={0}
                    required
                    className="input-field text-center font-bold text-brand-700"
                    value={bagsCount}
                    onChange={(e) => setBagsCount(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="label-field">المبلغ المالي المخصص (جنيه)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    className="input-field text-center font-bold text-emerald-700"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className="label-field">ملاحظات (اختياري)</label>
                <textarea
                  className="input-field min-h-[70px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أي ملاحظات حول حالة العائلة أو ظروفها..."
                />
              </div>

              {/* أفراد العائلة — يظهر فقط عند التعديل */}
              {editingFamily && editingFamily.beneficiaries.length > 0 && (
                <div>
                  <label className="label-field mb-2 block">أفراد العائلة</label>
                  <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
                    {editingFamily.beneficiaries.map((b) => (
                      <li key={b.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              b.isFamilyHead
                                ? "bg-amber-100 text-amber-800"
                                : "bg-brand-50 text-brand-700"
                            }`}
                          >
                            {b.isFamilyHead ? "رب الأسرة" : "فرد"}
                          </span>
                          <span className="text-sm font-medium text-gray-800 truncate">{b.fullName}</span>
                        </div>
                        <button
                          type="button"
                          disabled={removingMemberId === b.id}
                          onClick={() => removeMember(b.id, b.fullName)}
                          className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                        >
                          {removingMemberId === b.id ? "جاري الإزالة..." : "إزالة"}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  إلغاء
                </button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? "جاري الحفظ..." : "حفظ العائلة"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* قائمة العائلات */}
      {loading ? (
        <div className="card-surface p-8 text-center text-sm text-gray-500">جاري تحميل البيانات...</div>
      ) : families.length === 0 ? (
        <div className="card-surface p-8 text-center text-sm text-gray-500">
          لا توجد عائلات مسجلة حاليًا
        </div>
      ) : (
        <>
          <div className="card-surface overflow-x-auto p-0">
            <table className="w-full min-w-[800px] text-right text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">كود العائلة</th>
                  <th className="px-4 py-3 font-medium">اسم العائلة</th>
                  <th className="px-4 py-3 font-medium text-center">عدد الشنط</th>
                  <th className="px-4 py-3 font-medium text-center">المبلغ المالي</th>
                  <th className="px-4 py-3 font-medium">حالة استلام الشهر</th>
                  <th className="px-4 py-3 font-medium">أفراد العائلة</th>
                  <th className="px-4 py-3 font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {families.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-mono font-bold text-gray-900">
                      <span className="rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                        {f.familyCode}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900">{f.familyName}</td>
                    <td className="px-4 py-3 text-center font-bold text-brand-700">{f.bagsCount} شنطة</td>
                    <td className="px-4 py-3 text-center font-bold text-emerald-700">{f.cashAmount} ج.م</td>
                    <td className="px-4 py-3">
                      {f.redeemedThisMonth ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          ✅ تم الاستلام ({f.redeemedByMember})
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                          لم يستلم بعد
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[240px]">
                      {f.beneficiaries.length === 0 ? (
                        <span className="text-gray-400 text-xs">لا يوجد أفراد بعد</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {f.beneficiaries.map((b) => (
                            <Link
                              key={b.id}
                              href={`/dashboard/${b.id}`}
                              className={`inline-block rounded px-1.5 py-0.5 text-[11px] transition-opacity hover:opacity-75 ${
                                b.isFamilyHead
                                  ? "bg-amber-50 text-amber-800 border border-amber-200 font-bold"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}
                            >
                              {b.fullName}
                            </Link>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(f)}
                          className="text-sm font-medium text-brand-700 hover:underline"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => handleDelete(f)}
                          className="text-sm font-medium text-red-600 hover:underline"
                        >
                          مسح
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                className="btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                السابق
              </button>
              <span className="text-sm text-gray-500">
                صفحة {page} من {totalPages}
              </span>
              <button
                className="btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                التالي
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
