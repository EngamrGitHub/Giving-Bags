"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import toast from "react-hot-toast";
import {
  findCachedByBarcode,
  markCachedAsRedeemed,
  queueRedemption,
  currentMonthKey,
} from "@/lib/offlineDb";
import CameraScanner from "@/components/CameraScanner";

/* ─── Types ──────────────────────────────────────────────── */
interface BeneficiaryPreview {
  id: string;
  fullName: string;
  age: number;
  nationalId: string;
  phone: string;
  address: string;
  barcode: string;
  isFamilyHead: boolean;
  familyCode: string | null;
  familyName: string | null;
  bagsCount: number;
  cashAmount: number;
}

interface PreviewState {
  beneficiary: BeneficiaryPreview;
  alreadyRedeemed: boolean;
  redeemedAt: string | null;
  monthLabel: string;
}

type SubmitState =
  | { status: "success"; fullName: string; bagsDelivered: number; cashDelivered: number; monthLabel: string; offline?: boolean }
  | { status: "error"; message: string; alreadyRedeemed?: boolean; redeemedAt?: string; fullName?: string };

/* ─── Helpers ────────────────────────────────────────────── */
const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
function currentMonthLabel() {
  const now = new Date();
  return `${ARABIC_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

/* ─── Page ───────────────────────────────────────────────── */
export default function ScanPage() {
  // Scan input
  const [barcode, setBarcode] = useState("");
  const [redeemedBy, setRedeemedBy] = useState("");
  const [showCamera, setShowCamera] = useState(false);

  // Flow state
  const [step, setStep] = useState<"input" | "preview" | "done">("input");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  // Custom overrides for bags & cash
  const [customBags, setCustomBags] = useState<number | null>(null);
  const [customCash, setCustomCash] = useState<number | null>(null);

  // Data
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitState | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Always keep input focused when on "input" step
  useEffect(() => {
    if (step === "input") inputRef.current?.focus();
  }, [step]);

  /* ── Step 1: fetch preview ── */
  const fetchPreview = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    setLoadingPreview(true);
    setPreview(null);
    setSubmitResult(null);
    setCustomBags(null);
    setCustomCash(null);

    try {
      const res = await fetch(
        `/api/redeem/preview?barcode=${encodeURIComponent(trimmed)}`,
        { headers: { "x-client-date": new Date().toISOString() } }
      );
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "تعذر جلب البيانات");
        setBarcode("");
        inputRef.current?.focus();
        return;
      }

      setPreview(data);
      setCustomBags(data.beneficiary.bagsCount);
      setCustomCash(data.beneficiary.cashAmount);
      setStep("preview");
    } catch {
      toast.error("لا يوجد اتصال بالإنترنت");
      setBarcode("");
      inputRef.current?.focus();
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  /* ── Step 2: confirm redemption ── */
  const confirmRedeem = useCallback(async () => {
    if (!preview) return;
    setLoadingSubmit(true);

    const finalBags = customBags ?? preview.beneficiary.bagsCount;
    const finalCash = customCash ?? preview.beneficiary.cashAmount;

    if (!navigator.onLine) {
      // Offline path
      try {
        const cached = await findCachedByBarcode(preview.beneficiary.barcode);
        if (cached) {
          await queueRedemption({ barcode: preview.beneficiary.barcode, redeemedBy });
          await markCachedAsRedeemed(cached.id);
        }
        setSubmitResult({
          status: "success",
          fullName: preview.beneficiary.fullName,
          bagsDelivered: finalBags,
          cashDelivered: finalCash,
          monthLabel: currentMonthLabel(),
          offline: true,
        });
        toast.success(`تم التسجيل محليًا لـ ${preview.beneficiary.fullName} (بدون نت)`);
      } catch {
        toast.error("فشل التسجيل المحلي");
      } finally {
        setLoadingSubmit(false);
        setStep("done");
        setBarcode("");
      }
      return;
    }

    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-date": new Date().toISOString(),
        },
        body: JSON.stringify({
          barcode: preview.beneficiary.barcode,
          redeemedBy,
          customBags: finalBags,
          customCash: finalCash,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSubmitResult({
          status: "error",
          message: data.error,
          alreadyRedeemed: data.alreadyRedeemed,
          redeemedAt: data.beneficiary?.redeemedAt,
          fullName: data.beneficiary?.fullName,
        });
        toast.error(data.error);
      } else {
        setSubmitResult({
          status: "success",
          fullName: data.beneficiary.fullName,
          bagsDelivered: data.beneficiary.bagsDelivered,
          cashDelivered: data.beneficiary.cashDelivered,
          monthLabel: data.monthLabel,
        });
        toast.success(`✅ تم تسليم ${data.beneficiary.bagsDelivered} شنطة لـ ${data.beneficiary.fullName}`);
      }
      setStep("done");
      setBarcode("");
    } catch {
      // Network error — show error and stay on preview so user can retry
      toast.error("حدث خطأ في الاتصال، تحقق من الإنترنت وحاول مرة أخرى");
    } finally {
      setLoadingSubmit(false);
    }
  }, [preview, redeemedBy, customBags, customCash]);

  /* ── Keyboard: Enter on input step → preview; Enter on preview step → submit ── */
  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (barcode.trim()) fetchPreview(barcode);
    }
  };

  /* ── Reset back to scan another ── */
  const resetToScan = () => {
    setStep("input");
    setBarcode("");
    setPreview(null);
    setSubmitResult(null);
    setCustomBags(null);
    setCustomCash(null);
  };

  /* ── Camera scan ── */
  const handleCameraScan = (scannedCode: string) => {
    toast.success(`تم قراءة الكود: ${scannedCode}`);
    setBarcode(scannedCode);
    setShowCamera(false);
    fetchPreview(scannedCode);
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">تسليم شنطة</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {step === "input" && "امسح الباركود أو الصق الكود ثم اضغط Enter"}
            {step === "preview" && "راجع البيانات ثم اضغط Enter للتأكيد"}
            {step === "done" && "تمت العملية — يمكنك مسح الكود التالي"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {step !== "input" && (
            <button onClick={resetToScan} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              ← مسح آخر
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCamera((p) => !p)}
            className={`rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition ${
              showCamera
                ? "bg-gray-200 text-gray-800 hover:bg-gray-300"
                : "bg-brand-600 text-white hover:bg-brand-700"
            }`}
          >
            {showCamera ? "إغلاق الكاميرا" : "📷 كاميرا"}
          </button>
        </div>
      </div>

      {/* Camera */}
      {showCamera && (
        <CameraScanner onScanSuccess={handleCameraScan} onClose={() => setShowCamera(false)} />
      )}

      {/* ── STEP 1: Barcode Input ── */}
      <div className="card-surface space-y-4">
        <div>
          <label className="label-field">كود الباركود / QR</label>
          <input
            ref={inputRef}
            className={`input-field text-center text-lg tracking-widest font-mono transition-all ${
              step === "preview" ? "bg-gray-50 text-gray-400" : ""
            }`}
            dir="ltr"
            value={barcode}
            onChange={(e) => {
              setBarcode(e.target.value);
              // If user edits barcode after preview, reset to input step
              if (step !== "input") {
                setStep("input");
                setPreview(null);
                setSubmitResult(null);
              }
            }}
            onKeyDown={handleBarcodeKeyDown}
            placeholder="BAG-XXXXXXXX"
            autoFocus
            readOnly={step === "preview" || step === "done"}
          />
          <p className="mt-1 text-center text-[11px] text-gray-400">
            {step === "input" && "الصق الكود أو اكتبه ← اضغط Enter"}
            {step === "preview" && "اضغط Enter أو زر التأكيد أدناه"}
            {step === "done" && "اكتب أو الصق الكود التالي"}
          </p>
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

        {step === "input" && (
          <button
            type="button"
            disabled={!barcode.trim() || loadingPreview}
            onClick={() => fetchPreview(barcode)}
            className="btn-primary w-full"
          >
            {loadingPreview ? "جاري البحث..." : "🔍 بحث — معاينة البيانات"}
          </button>
        )}
      </div>

      {/* ── STEP 2: Preview card ── */}
      {step === "preview" && preview && (
        <PreviewCard
          preview={preview}
          customBags={customBags ?? preview.beneficiary.bagsCount}
          customCash={customCash ?? preview.beneficiary.cashAmount}
          onBagsChange={setCustomBags}
          onCashChange={setCustomCash}
          onConfirm={confirmRedeem}
          onCancel={resetToScan}
          loading={loadingSubmit}
        />
      )}

      {/* ── STEP 3: Result ── */}
      {step === "done" && submitResult && (
        <ResultCard result={submitResult} onReset={resetToScan} />
      )}
    </div>
  );
}

/* ─── Preview Card Component ─────────────────────────────── */
function PreviewCard({
  preview,
  customBags,
  customCash,
  onBagsChange,
  onCashChange,
  onConfirm,
  onCancel,
  loading,
}: {
  preview: PreviewState;
  customBags: number;
  customCash: number;
  onBagsChange: (v: number) => void;
  onCashChange: (v: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const { beneficiary, alreadyRedeemed, redeemedAt, monthLabel } = preview;
  const defaultBags = beneficiary.bagsCount;
  const defaultCash = beneficiary.cashAmount;
  const bagsModified = customBags !== defaultBags;
  const cashModified = customCash !== defaultCash;

  // Allow Enter key to confirm
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !alreadyRedeemed && !loading) {
        e.preventDefault();
        onConfirm();
      }
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [alreadyRedeemed, loading, onConfirm, onCancel]);

  return (
    <div
      className={`card-surface border-r-4 space-y-4 ${
        alreadyRedeemed ? "border-amber-400 bg-amber-50/40" : "border-brand-500 bg-brand-50/30"
      }`}
    >
      {/* Status badge */}
      <div className="flex items-center justify-between">
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            alreadyRedeemed
              ? "bg-amber-100 text-amber-800"
              : "bg-brand-100 text-brand-800"
          }`}
        >
          {alreadyRedeemed ? `⚠️ استلم بالفعل — ${monthLabel}` : `✅ مؤهل للاستلام — ${monthLabel}`}
        </span>
        {beneficiary.familyName && (
          <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-600">
            {beneficiary.familyCode}
          </span>
        )}
      </div>

      {/* Beneficiary info */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <span className="text-gray-500">الاسم</span>
          <span className="font-bold text-gray-900 text-base">
            {beneficiary.fullName}
            {beneficiary.isFamilyHead && (
              <span className="mr-1 text-xs font-normal text-amber-700">(رب الأسرة)</span>
            )}
          </span>
        </div>
        {beneficiary.familyName && (
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <span className="text-gray-500">العائلة</span>
            <span className="font-semibold text-brand-700">{beneficiary.familyName}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <span className="text-gray-500">الرقم القومي</span>
          <span className="font-mono font-medium text-gray-900" dir="ltr">{beneficiary.nationalId}</span>
        </div>
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <span className="text-gray-500">الموبايل</span>
          <span className="font-mono font-medium text-gray-900" dir="ltr">{beneficiary.phone}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">العنوان</span>
          <span className="font-medium text-gray-900 max-w-[60%] text-left">{beneficiary.address}</span>
        </div>
      </div>

      {/* Allocation controls */}
      <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
        {/* Bags counter */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
          <div>
            <p className="text-xs font-semibold text-gray-500">عدد الشنط</p>
            {bagsModified && (
              <p className="text-[10px] text-brand-500">(الأصلي: {defaultBags})</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={alreadyRedeemed || customBags <= 0}
              onClick={() => onBagsChange(Math.max(0, customBags - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              −
            </button>
            <span className={`w-10 text-center text-2xl font-black tabular-nums ${
              bagsModified ? "text-brand-700" : "text-gray-900"
            }`}>
              {customBags}
            </span>
            <button
              type="button"
              disabled={alreadyRedeemed}
              onClick={() => onBagsChange(customBags + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
        </div>

        {/* Cash input */}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-gray-500">المبلغ المالي (ج.م)</p>
            {cashModified && (
              <p className="text-[10px] text-emerald-600">(الأصلي: {defaultCash} ج.م)</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={10}
              disabled={alreadyRedeemed}
              value={customCash}
              onChange={(e) => onCashChange(Math.max(0, Number(e.target.value)))}
              className={`w-24 rounded-lg border px-2 py-1.5 text-center text-lg font-black tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50 ${
                cashModified
                  ? "border-emerald-400 text-emerald-700 bg-emerald-50"
                  : "border-gray-200 text-gray-900"
              }`}
              dir="ltr"
            />
            <span className="text-sm text-gray-400 font-medium">ج.م</span>
          </div>
        </div>
      </div>

      {/* Already redeemed warning */}
      {alreadyRedeemed && redeemedAt && (
        <div className="rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-800 font-medium">
          ⚠️ تم الاستلام في {new Date(redeemedAt).toLocaleString("ar-EG")}
          <br />
          <span className="text-amber-600 text-xs font-normal">لا يمكن التأكيد مرة أخرى هذا الشهر</span>
        </div>
      )}

      {/* Reset to defaults button */}
      {!alreadyRedeemed && (bagsModified || cashModified) && (
        <button
          type="button"
          onClick={() => { onBagsChange(defaultBags); onCashChange(defaultCash); }}
          className="w-full rounded-xl border border-dashed border-gray-300 py-2 text-xs font-medium text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
        >
          ↩ إعادة تعيين للقيم الأصلية ({defaultBags} شنطة / {defaultCash} ج.م)
        </button>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          إلغاء (Esc)
        </button>
        <button
          type="button"
          disabled={alreadyRedeemed || loading}
          onClick={onConfirm}
          className="flex-[2] btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "جاري التأكيد..." : "تأكيد التسليم (Enter) ↵"}
        </button>
      </div>
    </div>
  );
}

/* ─── Result Card Component ──────────────────────────────── */
function ResultCard({
  result,
  onReset,
}: {
  result: SubmitState;
  onReset: () => void;
}) {
  // Allow Enter to reset
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") { e.preventDefault(); onReset(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onReset]);

  if (result.status === "success") {
    return (
      <div className="card-surface border-r-4 border-emerald-500 bg-emerald-50/40 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-xl">✅</div>
          <div>
            <p className="font-bold text-emerald-800 text-base">تم التسليم بنجاح!</p>
            <p className="text-sm text-emerald-700">
              {result.fullName} — {result.monthLabel}
              {result.offline && <span className="mr-2 text-xs text-amber-700 font-medium">(محفوظ محلياً)</span>}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-white p-3 border border-emerald-100">
          <div className="text-center">
            <p className="text-[11px] text-gray-400">الشنط المسلّمة</p>
            <p className="text-2xl font-black text-brand-700">{result.bagsDelivered} <span className="text-sm">شنطة</span></p>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-gray-400">المبلغ المسلّم</p>
            <p className="text-2xl font-black text-emerald-700">{result.cashDelivered} <span className="text-sm">ج.م</span></p>
          </div>
        </div>

        <button onClick={onReset} className="btn-primary w-full">
          مسح كارت آخر (Enter) ↵
        </button>
      </div>
    );
  }

  return (
    <div className="card-surface border-r-4 border-red-400 bg-red-50/50 space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-xl">❌</div>
        <div>
          <p className="font-bold text-red-800">فشلت العملية</p>
          <p className="text-sm text-red-700">{result.message}</p>
        </div>
      </div>
      {result.alreadyRedeemed && result.redeemedAt && result.fullName && (
        <p className="text-sm text-red-600">
          {result.fullName} — استلم في {new Date(result.redeemedAt).toLocaleString("ar-EG")}
        </p>
      )}
      <button onClick={onReset} className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
        حاول مرة أخرى
      </button>
    </div>
  );
}
