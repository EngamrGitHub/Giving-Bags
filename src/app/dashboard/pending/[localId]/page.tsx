"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  getPendingBeneficiaries,
  removePendingBeneficiary,
  type PendingBeneficiary,
} from "@/lib/offlineDb";
import BeneficiaryCard from "@/components/BeneficiaryCard";

export default function PendingBeneficiaryPage() {
  const params = useParams<{ localId: string }>();
  const router = useRouter();
  const [entry, setEntry] = useState<PendingBeneficiary | null | undefined>(
    undefined
  );

  useEffect(() => {
    (async () => {
      const all = await getPendingBeneficiaries();
      const found = all.find((e) => e.localId === params.localId);
      setEntry(found ?? null);
    })();
  }, [params.localId]);

  async function handleDiscard() {
    if (!entry) return;
    const confirmed = window.confirm(
      "هل تريد حذف هذا المستفيد من قائمة الانتظار المحلية؟ (لم تتم مزامنته بعد)"
    );
    if (!confirmed) return;
    await removePendingBeneficiary(entry.localId);
    toast.success("تم الحذف من قائمة الانتظار المحلية");
    router.push("/dashboard");
  }

  if (entry === undefined) {
    return <p className="text-center text-gray-400">جاري التحميل...</p>;
  }

  if (entry === null) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-gray-500">
          هذا السجل غير موجود — على الأغلب تمت مزامنته بالفعل مع السيرفر.
        </p>
        <Link href="/dashboard" className="btn-primary mt-4 inline-flex">
          الرجوع لقائمة المستفيدين
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
        📡 هذا المستفيد اتسجل محليًا على الجهاز ده ولسه ما اتزامنش مع السيرفر.
        {entry.status === "conflict" && (
          <p className="mt-1 text-red-700">⚠️ تعارض عند المزامنة: {entry.message}</p>
        )}
        {entry.status === "error" && (
          <p className="mt-1 text-red-700">⚠️ خطأ عند المزامنة: {entry.message}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {entry.payload.fullName}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            الرقم القومي: {entry.payload.nationalId}
          </p>
        </div>
        <div className="no-print flex gap-2">
          <button onClick={() => window.print()} className="btn-primary">
            🖨️ طباعة الكارت
          </button>
          <button onClick={handleDiscard} className="btn-danger">
            🗑️ حذف
          </button>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="card-surface space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">السن</span>
            <span className="font-medium text-gray-900">
              {entry.payload.age}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">الموبايل</span>
            <span className="font-medium text-gray-900" dir="ltr">
              {entry.payload.phone}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">العنوان</span>
            <span className="max-w-[60%] text-left font-medium text-gray-900">
              {entry.payload.address}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center print-page">
          <BeneficiaryCard
            data={{
              fullName: entry.payload.fullName,
              nationalId: entry.payload.nationalId,
              barcode: entry.localBarcode,
            }}
          />
        </div>
      </div>
    </div>
  );
}
