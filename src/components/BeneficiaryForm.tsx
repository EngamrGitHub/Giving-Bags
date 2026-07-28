"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { queueBeneficiary } from "@/lib/offlineDb";
import { generateBarcodeValue } from "@/lib/barcode";

export interface BeneficiaryFormValues {
  fullName: string;
  age: string;
  nationalId: string;
  phone: string;
  address: string;
  notes: string;
  familyId?: string;
  isFamilyHead?: boolean;
  documentsProvided?: boolean;
}

const emptyValues: BeneficiaryFormValues = {
  fullName: "",
  age: "",
  nationalId: "",
  phone: "",
  address: "",
  notes: "",
  familyId: "",
  isFamilyHead: false,
  documentsProvided: false,
};

interface BeneficiaryFormProps {
  mode: "create" | "edit";
  beneficiaryId?: string;
  initialValues?: BeneficiaryFormValues;
}

interface FamilyOption {
  id: string;
  familyCode: string;
  familyName: string;
  bagsCount: number;
  cashAmount: number;
}

export default function BeneficiaryForm({
  mode,
  beneficiaryId,
  initialValues,
}: BeneficiaryFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<BeneficiaryFormValues>(
    initialValues ?? emptyValues
  );
  const [families, setFamilies] = useState<FamilyOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/families")
      .then((res) => res.json())
      .then((data) => setFamilies(data.families || []))
      .catch(() => {});
  }, []);

  function update<K extends keyof BeneficiaryFormValues>(
    key: K,
    value: BeneficiaryFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    const payload = {
      fullName: values.fullName,
      age: values.age,
      nationalId: values.nationalId,
      phone: values.phone,
      address: values.address,
      notes: values.notes,
      familyId: values.familyId || null,
      isFamilyHead: values.isFamilyHead || false,
      documentsProvided: values.documentsProvided || false,
    };

    // إضافة مستفيد جديد بدون إنترنت: نسجّله محليًا ونرجع نزامنه بعدين
    if (mode === "create" && typeof window !== "undefined" && !navigator.onLine) {
      await saveOffline(payload);
      return;
    }

    try {
      const url =
        mode === "create"
          ? "/api/beneficiaries"
          : `/api/beneficiaries/${beneficiaryId}`;
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "حدث خطأ، حاول مرة أخرى");
        setLoading(false);
        return;
      }

      toast.success(mode === "create" ? "تمت إضافة المستفيد بنجاح" : "تم حفظ التعديلات");

      if (mode === "create") {
        router.push(`/dashboard/${data.item.id}`);
      } else {
        router.push(`/dashboard/${beneficiaryId}`);
      }
      router.refresh();
      setLoading(false);
    } catch {
      // فشل الاتصال بالسيرفر أثناء الإضافة — لو كنا بنضيف مستفيد جديد نخزنه محليًا
      if (mode === "create") {
        await saveOffline(payload);
      } else {
        toast.error("تعذر الاتصال بالخادم. التعديل محتاج إنترنت من فضلك");
        setLoading(false);
      }
    }
  }

  async function saveOffline(payload: {
    fullName: string;
    age: string;
    nationalId: string;
    phone: string;
    address: string;
    notes: string;
  }) {
    try {
      const localBarcode = generateBarcodeValue();
      const entry = await queueBeneficiary({
        payload,
        localBarcode,
      });
      toast.success(
        "مفيش إنترنت دلوقتي — تم حفظ بيانات المستفيد محليًا وهيتزامن أول ما النت يرجع"
      );
      router.push(`/dashboard/pending/${entry.localId}`);
    } catch {
      toast.error("تعذر الحفظ محليًا على هذا الجهاز");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card-surface space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label-field">الاسم الكامل</label>
          <input
            className="input-field"
            value={values.fullName}
            onChange={(e) => update("fullName", e.target.value)}
            placeholder="مثال: محمد أحمد علي"
            required
          />
        </div>

        <div>
          <label className="label-field">السن</label>
          <input
            className="input-field"
            type="number"
            min={0}
            max={120}
            value={values.age}
            onChange={(e) => update("age", e.target.value)}
            placeholder="مثال: 35"
            required
          />
        </div>

        <div>
          <label className="label-field">الرقم القومي (14 رقم)</label>
          <input
            className="input-field"
            inputMode="numeric"
            value={values.nationalId}
            onChange={(e) => update("nationalId", e.target.value)}
            placeholder="29001011234567"
            maxLength={14}
            required
          />
        </div>

        <div>
          <label className="label-field">رقم الموبايل</label>
          <input
            className="input-field"
            inputMode="tel"
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="01012345678"
            maxLength={11}
            required
          />
        </div>

        <div className="sm:col-span-2 rounded-xl bg-gray-50 p-4 border border-gray-200">
          <label className="label-field font-bold text-gray-900">ربط بالعائلة (اختر عائلة مسجلة برقم فريد)</label>
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              className="input-field"
              value={values.familyId || ""}
              onChange={(e) => update("familyId", e.target.value)}
            >
              <option value="">-- بدون عائلة (مستفيد مستقل) --</option>
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  [{f.familyCode}] {f.familyName} ({f.bagsCount} شنطة / {f.cashAmount} ج.م)
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 text-xs font-bold text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                checked={values.isFamilyHead || false}
                onChange={(e) => update("isFamilyHead", e.target.checked)}
              />
              <span>هذا المستفيد هو (رب / مسئول العائلة)</span>
            </label>
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-3.5 text-sm font-semibold text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              checked={values.documentsProvided || false}
              onChange={(e) => update("documentsProvided", e.target.checked)}
            />
            <span>تم تقديم الأوراق المطلوبة (البطاقة، القسيمة، إثبات الدخل... إلخ)</span>
          </label>
        </div>

        <div className="sm:col-span-2">
          <label className="label-field">العنوان (اختياري)</label>
          <input
            className="input-field"
            value={values.address}
            onChange={(e) => update("address", e.target.value)}
            placeholder="المنطقة، الشارع، رقم العقار (اختياري)"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label-field">ملاحظات (اختياري)</label>
          <textarea
            className="input-field"
            rows={3}
            value={values.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="أي معلومات إضافية عن الحالة..."
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary"
          disabled={loading}
        >
          إلغاء
        </button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading
            ? "جاري الحفظ..."
            : mode === "create"
            ? "إضافة المستفيد وإصدار الكارت"
            : "حفظ التعديلات"}
        </button>
      </div>
    </form>
  );
}
