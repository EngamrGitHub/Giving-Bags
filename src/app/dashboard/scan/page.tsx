"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import toast from "react-hot-toast";
import {
  findCachedByBarcode,
  markCachedAsRedeemed,
  queueRedemption,
  currentMonthKey,
} from "@/lib/offlineDb";
import CameraScanner from "@/components/CameraScanner";

interface RedeemSuccess {
  success: true;
  offline?: boolean;
  beneficiary: {
    fullName: string;
    age: number;
    nationalId: string;
    phone: string;
    address: string;
    isFamilyHead?: boolean;
    familyCode?: string | null;
    familyName?: string | null;
    bagsDelivered?: number;
    cashDelivered?: number;
  };
  monthLabel: string;
}

interface RedeemError {
  error: string;
  alreadyRedeemed?: boolean;
  beneficiary?: { fullName: string; nationalId: string; redeemedAt: string };
}

type ScanResult =
  | { type: "success"; data: RedeemSuccess }
  | { type: "error"; data: RedeemError }
  | null;

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function currentMonthLabel() {
  const now = new Date();
  return `${ARABIC_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

export default function ScanPage() {
  const [barcode, setBarcode] = useState("");
  const [redeemedBy, setRedeemedBy] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [result, setResult] = useState<ScanResult>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function processRedeem(codeToRedeem: string) {
    const code = codeToRedeem.trim();
    if (!code) return;

    setLoading(true);
    setResult(null);

    if (!navigator.onLine) {
      await handleOfflineRedeem(code);
      return;
    }

    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-date": new Date().toISOString(),
        },
        body: JSON.stringify({ barcode: code, redeemedBy }),
      });
      const data = await res.json();

      if (!res.ok) {
        setResult({ type: "error", data });
        toast.error(data.error);
      } else {
        setResult({ type: "success", data });
        toast.success(`تم تسليم الشنطة لـ ${data.beneficiary.fullName}`);
      }
      setLoading(false);
      setBarcode("");
      setShowCamera(false);
      inputRef.current?.focus();
    } catch {
      await handleOfflineRedeem(code);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await processRedeem(barcode);
  }

  const handleCameraScan = (scannedCode: string) => {
    toast.success(`تم قراءة الكود: ${scannedCode}`);
    setBarcode(scannedCode);
    processRedeem(scannedCode);
  };

  async function handleOfflineRedeem(code: string) {
    try {
      const cached = await findCachedByBarcode(code);

      if (!cached) {
        setResult({
          type: "error",
          data: {
            error:
              "مفيش اتصال بالإنترنت، والباركود ده مش موجود في البيانات المحفوظة على الجهاز",
          },
        });
        toast.error("تعذر التحقق من الباركود بدون إنترنت");
        return;
      }

      if (!cached.isActive) {
        setResult({
          type: "error",
          data: { error: `المستفيد "${cached.fullName}" غير نشط حاليًا` },
        });
        return;
      }

      const isSameMonth = cached.redeemedMonthKey === currentMonthKey();
      if (cached.redeemedThisMonth && isSameMonth) {
        setResult({
          type: "error",
          data: {
            error: `تم استلام الشنطة بالفعل هذا الشهر (${currentMonthLabel()}) — حسب آخر بيانات محفوظة`,
            alreadyRedeemed: true,
            beneficiary: {
              fullName: cached.fullName,
              nationalId: cached.nationalId,
              redeemedAt: new Date().toISOString(),
            },
          },
        });
        toast.error("تم الاستلام من قبل هذا الشهر");
        return;
      }

      await queueRedemption({ barcode: code, redeemedBy });
      await markCachedAsRedeemed(cached.id);

      setResult({
        type: "success",
        data: {
          success: true,
          offline: true,
          monthLabel: currentMonthLabel(),
          beneficiary: {
            fullName: cached.fullName,
            age: cached.age,
            nationalId: cached.nationalId,
            phone: cached.phone,
            address: cached.address,
          },
        },
      });
      toast.success(`تم تسجيل التسليم محليًا لـ ${cached.fullName} (بدون نت)`);
    } finally {
      setLoading(false);
      setBarcode("");
      inputRef.current?.focus();
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">تسليم شنطة</h1>
          <p className="mt-1 text-sm text-gray-500">
            امسح باركود/QR الكارت بالكاميرا أو بجهاز القراءة أو اكتب الكود يدويًا
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCamera((prev) => !prev)}
          className={`rounded-xl px-4 py-2.5 text-sm font-bold transition shadow-sm ${
            showCamera
              ? "bg-gray-200 text-gray-800 hover:bg-gray-300"
              : "bg-brand-600 text-white hover:bg-brand-700 shadow-brand-200"
          }`}
        >
          {showCamera ? "إغلاق الكاميرا" : "مسح بالكاميرا (QR / Barcode)"}
        </button>
      </div>

      {showCamera && (
        <CameraScanner
          onScanSuccess={handleCameraScan}
          onClose={() => setShowCamera(false)}
        />
      )}

      <form onSubmit={handleSubmit} className="card-surface space-y-4">
        <div>
          <label className="label-field">كود الباركود / QR</label>
          <input
            ref={inputRef}
            className="input-field text-center text-lg tracking-widest"
            dir="ltr"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="امسح الباركود أو QR هنا..."
            autoFocus
            required
          />
        </div>
        <div>
          <label className="label-field">اسم المسؤول عن التسليم (اختياري)</label>
          <input
            className="input-field"
            value={redeemedBy}
            onChange={(e) => setRedeemedBy(e.target.value)}
            placeholder="مثال: أحمد - مسؤول البوابة"
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "جاري التحقق..." : "تأكيد الاستلام"}
        </button>
      </form>

      {result?.type === "success" && (
        <div className="card-surface border-r-4 border-brand-500 bg-brand-50/50 space-y-3">
          <p className="text-sm font-bold text-brand-800 flex items-center justify-between">
            <span>تم التسليم بنجاح — {result.data.monthLabel}</span>
            {result.data.beneficiary.familyName && (
              <span className="rounded bg-brand-200 px-2 py-0.5 text-xs text-brand-900 font-mono">
                كود العائلة: {result.data.beneficiary.familyCode}
              </span>
            )}
          </p>

          {/* بطاقات المساعدات المستلمة */}
          <div className="grid grid-cols-2 gap-2 text-center my-2">
            <div className="rounded-xl bg-white p-2.5 shadow-2xs border border-brand-100">
              <p className="text-xs text-brand-600 font-medium">عدد الشنط المسلّمة</p>
              <p className="text-lg font-black text-brand-800">{result.data.beneficiary.bagsDelivered ?? 1} شنطة</p>
            </div>
            <div className="rounded-xl bg-white p-2.5 shadow-2xs border border-emerald-100">
              <p className="text-xs text-emerald-600 font-medium">المبلغ المالي المسلّم</p>
              <p className="text-lg font-black text-emerald-800">{result.data.beneficiary.cashDelivered ?? 0} ج.م</p>
            </div>
          </div>

          <dl className="space-y-1 text-sm text-gray-700">
            <div className="flex justify-between">
              <dt>اسم المستلم</dt>
              <dd className="font-bold text-gray-900">
                {result.data.beneficiary.fullName}
                {result.data.beneficiary.isFamilyHead && " (مسؤول العائلة)"}
              </dd>
            </div>
            {result.data.beneficiary.familyName && (
              <div className="flex justify-between">
                <dt>العائلة التابع لها</dt>
                <dd className="font-bold text-brand-700">{result.data.beneficiary.familyName}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>الرقم القومي</dt>
              <dd className="font-medium" dir="ltr">
                {result.data.beneficiary.nationalId}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>العنوان</dt>
              <dd className="max-w-[60%] text-left font-medium">
                {result.data.beneficiary.address}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {result?.type === "error" && (
        <div className="card-surface border-r-4 border-red-400 bg-red-50/50">
          <p className="text-sm font-semibold text-red-700">
            {result.data.error}
          </p>
          {result.data.alreadyRedeemed && result.data.beneficiary && (
            <p className="mt-2 text-sm text-red-600">
              المستفيد: {result.data.beneficiary.fullName} — تم الاستلام في{" "}
              {new Date(result.data.beneficiary.redeemedAt).toLocaleString("ar-EG")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
