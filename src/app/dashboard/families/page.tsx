"use client";

import { useEffect, useState, FormEvent } from "react";
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

  // Form states
  const [familyCode, setFamilyCode] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [bagsCount, setBagsCount] = useState(1);
  const [cashAmount, setCashAmount] = useState(0);
  const [notes, setNotes] = useState("");

  async function fetchFamilies(query = "") {
    try {
      const res = await fetch(`/api/families?query=${encodeURIComponent(query)}`, {
        headers: { "x-client-date": new Date().toISOString() },
      });
      const data = await res.json();
      if (res.ok) {
        setFamilies(data.families || []);
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
    fetchFamilies();
  }, []);

  function openCreateModal() {
    setEditingFamily(null);
    setFamilyCode(`FAM-${Math.floor(1000 + Math.random() * 9000)}`);
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
        fetchFamilies(search);
      }
    } catch {
      toast.error("حدث خطأ أثناء الاتصال");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(f: FamilyItem) {
    if (!confirm(`هل أنت تأكد من مسح عائلة "${f.familyName}"؟`)) return;

    try {
      const res = await fetch(`/api/families/${f.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("تم مسح العائلة");
        fetchFamilies(search);
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
            fetchFamilies(e.target.value);
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
        <div className="grid gap-4 md:grid-cols-2">
          {families.map((f) => (
            <div key={f.id} className="card-surface flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between gap-2 border-b pb-3">
                  <div>
                    <span className="rounded bg-brand-50 px-2 py-0.5 font-mono text-xs font-bold text-brand-700">
                      {f.familyCode}
                    </span>
                    <h3 className="mt-1 text-base font-bold text-gray-900">{f.familyName}</h3>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(f)}
                      className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => handleDelete(f)}
                      className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                    >
                      مسح
                    </button>
                  </div>
                </div>

                {/* المخصصات */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl bg-brand-50/70 p-2.5">
                    <p className="text-xs text-brand-600 font-medium">عدد الشنط المخصصة</p>
                    <p className="text-lg font-extrabold text-brand-800">{f.bagsCount} شنطة</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50/70 p-2.5">
                    <p className="text-xs text-emerald-600 font-medium">المبلغ المالي المخصص</p>
                    <p className="text-lg font-extrabold text-emerald-800">{f.cashAmount} ج.م</p>
                  </div>
                </div>

                {/* حالة الاستلام للشهر الحالي */}
                <div className="mt-3">
                  {f.redeemedThisMonth ? (
                    <div className="rounded-xl bg-emerald-100/80 p-2.5 text-xs text-emerald-800">
                      <strong>تم استلام مخصصات الشهر بواسطة:</strong> {f.redeemedByMember}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800">
                      لم يتم استلام مخصصات هذا الشهر بعد
                    </div>
                  )}
                </div>

                {/* الأفراد التابعون للعائلة */}
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-bold text-gray-500">
                    الأفراد المسجلون برقم العائلة ({f.beneficiaries.length}):
                  </p>
                  {f.beneficiaries.length === 0 ? (
                    <p className="text-xs text-gray-400">لا يوجد أفراد مسجلين لهذه العائلة بعد</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {f.beneficiaries.map((b) => (
                        <span
                          key={b.id}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium ${b.isFamilyHead
                            ? "bg-amber-100 text-amber-900 border border-amber-300 font-bold"
                            : "bg-gray-100 text-gray-700"
                            }`}
                        >
                          {b.fullName}
                          {b.isFamilyHead && " (مسؤول العائلة)"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {f.notes && (
                <p className="border-t pt-2 text-xs text-gray-400">ملاحظات: {f.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
