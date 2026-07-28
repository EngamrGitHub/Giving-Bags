import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import BeneficiaryForm from "@/components/BeneficiaryForm";

export default async function EditBeneficiaryPage({
  params,
}: {
  params: { id: string };
}) {
  const beneficiary = await prisma.beneficiary.findUnique({
    where: { id: params.id },
  });

  if (!beneficiary) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">تعديل بيانات المستفيد</h1>
        <p className="mt-1 text-sm text-gray-500">{beneficiary.fullName}</p>
      </div>
      <BeneficiaryForm
        mode="edit"
        beneficiaryId={beneficiary.id}
        initialValues={{
          fullName: beneficiary.fullName,
          age: String(beneficiary.age),
          nationalId: beneficiary.nationalId,
          phone: beneficiary.phone,
          address: beneficiary.address,
          notes: beneficiary.notes ?? "",
          familyId: beneficiary.familyId ?? "",
          isFamilyHead: beneficiary.isFamilyHead ?? false,
          documentsProvided: beneficiary.documentsProvided ?? false,
        }}
      />
    </div>
  );
}
