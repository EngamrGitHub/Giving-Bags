import { prisma } from "@/lib/db";
import BeneficiaryCard from "@/components/BeneficiaryCard";
import PrintButton from "@/components/PrintButton";

export default async function CardsPage() {
  const beneficiaries = await prisma.beneficiary.findMany({
    where: { isActive: true },
    orderBy: { fullName: "asc" },
    include: {
      family: true,
    },
  });

  return (
    <div>
      <div className="no-print mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">طباعة كل الكروت</h1>
          <p className="mt-1 text-sm text-gray-500">
            {beneficiaries.length} كارت جاهز للطباعة
          </p>
        </div>
        <PrintButton />
      </div>

      {beneficiaries.length === 0 ? (
        <p className="text-sm text-gray-400">لا يوجد مستفيدون بعد</p>
      ) : (
        <div className="flex flex-wrap justify-center gap-4 print-page">
          {beneficiaries.map((b) => (
            <BeneficiaryCard
              key={b.id}
              data={{
                fullName: b.fullName,
                nationalId: b.nationalId,
                barcode: b.barcode,
                familyName: b.family?.familyName,
                familyCode: b.family?.familyCode,
                isFamilyHead: b.isFamilyHead,
                age: b.age,
                phone: b.phone,
                address: b.address,
                documentsProvided: b.documentsProvided,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
