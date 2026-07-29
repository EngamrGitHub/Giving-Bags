import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import BeneficiaryCard from "@/components/BeneficiaryCard";
import BeneficiaryActions from "@/components/BeneficiaryActions";

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export const dynamic = "force-dynamic";

export default async function BeneficiaryDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const beneficiary = await prisma.beneficiary.findUnique({
    where: { id: params.id },
    include: {
      family: true,
      redemptions: { orderBy: { redeemedAt: "desc" }, take: 12 },
    },
  });

  if (!beneficiary) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {beneficiary.fullName}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            الرقم القومي: {beneficiary.nationalId}
          </p>
        </div>
        <BeneficiaryActions id={beneficiary.id} fullName={beneficiary.fullName} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="no-print card-surface space-y-3">
          <h2 className="font-semibold text-gray-900">بيانات المستفيد والعائلة</h2>
          <dl className="space-y-2 text-sm">
            {beneficiary.family && (
              <div className="flex justify-between border-b pb-2">
                <dt className="text-gray-500">العائلة المسجل بها</dt>
                <dd className="font-bold text-brand-700">
                  {beneficiary.family.familyName} [{beneficiary.family.familyCode}]
                  {beneficiary.isFamilyHead && " (رب العائلة)"}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">السن</dt>
              <dd className="font-medium text-gray-900">{beneficiary.age}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">الموبايل</dt>
              <dd className="font-medium text-gray-900" dir="ltr">
                {beneficiary.phone}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">العنوان</dt>
              <dd className="max-w-[60%] text-left font-medium text-gray-900">
                {beneficiary.address}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">كود الباركود</dt>
              <dd className="font-mono font-medium text-gray-900" dir="ltr">
                {beneficiary.barcode}
              </dd>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2">
              <dt className="text-gray-500">الأوراق المطلوبة</dt>
              <dd className="font-medium text-gray-900">
                {beneficiary.documentsProvided ? (
                  <span className="text-green-600 font-bold">✅ نعم (تم تقديم الأوراق)</span>
                ) : (
                  <span className="text-red-600 font-bold">❌ لا (لم يقدّم الأوراق بعد)</span>
                )}
              </dd>
            </div>
            {beneficiary.notes && (
              <div className="border-t border-gray-100 pt-2">
                <dt className="mb-1 text-gray-500">ملاحظات</dt>
                <dd className="text-gray-800">{beneficiary.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="flex items-center justify-center print-page">
          <BeneficiaryCard
            data={{
              fullName: beneficiary.fullName,
              nationalId: beneficiary.nationalId,
              barcode: beneficiary.barcode,
              familyName: beneficiary.family?.familyName,
              familyCode: beneficiary.family?.familyCode,
              isFamilyHead: beneficiary.isFamilyHead,
              age: beneficiary.age,
              phone: beneficiary.phone,
              address: beneficiary.address,
              documentsProvided: beneficiary.documentsProvided,
            }}
          />
        </div>
      </div>

      <div className="card-surface no-print">
        <h2 className="mb-4 font-semibold text-gray-900">سجل استلام الشنط</h2>
        {beneficiary.redemptions.length === 0 ? (
          <p className="text-sm text-gray-400">لا يوجد سجل استلام حتى الآن</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {beneficiary.redemptions.map((r) => (
              <li key={r.id} className="py-3">
                {/* Row 1: month + date */}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">
                    {ARABIC_MONTHS[r.month - 1]} {r.year}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(r.redeemedAt).toLocaleString("ar-EG")}
                  </span>
                </div>
                {/* Row 2: bags + cash + staff */}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">
                    🛍️ {r.bagsDelivered} شنطة
                  </span>
                  {r.cashDelivered > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                      💵 {r.cashDelivered} ج.م
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
