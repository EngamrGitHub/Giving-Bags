import BeneficiaryForm from "@/components/BeneficiaryForm";

export default function NewBeneficiaryPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">إضافة مستفيد جديد</h1>
        <p className="mt-1 text-sm text-gray-500">
          سيتم إصدار كارت وباركود فريد تلقائيًا بمجرد إضافة المستفيد
        </p>
      </div>
      <BeneficiaryForm mode="create" />
    </div>
  );
}
