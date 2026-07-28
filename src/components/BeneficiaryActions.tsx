"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";

export default function BeneficiaryActions({
  id,
  fullName,
}: {
  id: string;
  fullName: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف المستفيد "${fullName}"؟ لا يمكن التراجع عن هذا الإجراء.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/beneficiaries/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "تعذر حذف المستفيد");
        return;
      }
      toast.success("تم حذف المستفيد");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("تعذر الاتصال بالخادم");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="no-print flex flex-wrap gap-2">
      <button onClick={() => window.print()} className="btn-primary">
        🖨️ طباعة الكارت (85 × 54 مم)
      </button>
      <Link href={`/dashboard/${id}/edit`} className="btn-secondary">
        ✏️ تعديل البيانات
      </Link>
      <button onClick={handleDelete} disabled={deleting} className="btn-danger">
        {deleting ? "جاري الحذف..." : "🗑️ حذف"}
      </button>
    </div>
  );
}
