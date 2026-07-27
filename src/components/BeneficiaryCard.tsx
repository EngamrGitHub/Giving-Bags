import Barcode from "./Barcode";
import { QRCodeSVG } from "qrcode.react";

export interface CardData {
  fullName: string;
  nationalId: string;
  barcode: string;
  familyName?: string | null;
  familyCode?: string | null;
  isFamilyHead?: boolean;
}

interface BeneficiaryCardProps {
  data: CardData;
  orgName?: string;
}

/**
 * كارت المستفيد بمقاس بطاقة تقريبي (85 × 54 مم) جاهز للطباعة.
 * يحتوي على اسم المؤسسة، اسم المستفيد، اسم العائلة، الرقم القومي، والباركود والـ QR Code.
 */
export default function BeneficiaryCard({
  data,
  orgName = process.env.NEXT_PUBLIC_ORG_NAME || "مؤسسة اللواء",
}: BeneficiaryCardProps) {
  return (
    <div
      className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm print:break-inside-avoid print:shadow-none"
      style={{ width: "340px", height: "215px" }}
    >
      <div className="absolute inset-x-0 top-0 h-2 bg-brand-600" />

      <div className="mt-1 flex items-start justify-between">
        <div>
          <p className="text-[10px] font-medium text-gray-400">بطاقة مستفيد</p>
          <h3 className="text-xs font-bold leading-tight text-gray-900">
            {orgName}
          </h3>
        </div>
        <img src="/logo.png" alt="شعار مؤسسة اللواء" className="h-8 w-auto object-contain" />
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-bold text-gray-900 line-clamp-1">{data.fullName}</p>
          {data.familyName && (
            <p className="text-[11px] font-bold text-brand-700 line-clamp-1">
              العائلة: {data.familyName} {data.isFamilyHead && "(مسؤول العائلة)"}
            </p>
          )}
          <p className="text-[11px] text-gray-500">
            الرقم القومي: <span className="font-medium text-gray-700">{data.nationalId}</span>
          </p>
        </div>
        <div className="shrink-0 rounded bg-white p-1 shadow-xs border border-gray-100">
          <QRCodeSVG value={data.barcode} size={48} level="M" />
        </div>
      </div>

      <div className="mt-1 flex flex-col items-center justify-center rounded-lg bg-gray-50 py-1">
        <Barcode value={data.barcode} width={1.4} height={40} fontSize={12} />
      </div>
    </div>
  );
}
