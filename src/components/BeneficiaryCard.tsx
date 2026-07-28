import Barcode from "./Barcode";
import { QRCodeSVG } from "qrcode.react";

export interface CardData {
  fullName: string;
  nationalId: string;
  barcode: string;
  familyName?: string | null;
  familyCode?: string | null;
  isFamilyHead?: boolean;
  age?: number | string | null;
  phone?: string | null;
  address?: string | null;
  documentsProvided?: boolean;
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
    <div className="flex flex-col gap-4 items-center">
      {/* Front Side */}
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

      {/* Back Side */}
      <div
        className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm print:break-inside-avoid print:shadow-none"
        style={{ width: "340px", height: "215px" }}
      >
        <div className="absolute inset-x-0 top-0 h-2 bg-brand-600" />

        <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
          <span className="text-[10px] font-bold text-gray-400">البيانات الشخصية للمستفيد</span>
          <h4 className="text-[11px] font-black text-brand-700">{orgName}</h4>
        </div>

        <div className="my-auto text-right text-[11px] leading-relaxed text-gray-700 space-y-1.5" dir="rtl">
          <div className="flex justify-between border-b border-gray-50 pb-1">
            <span className="font-bold text-gray-400">السن:</span>
            <span className="font-semibold text-gray-900">{data.age ?? "غير مدون"}</span>
          </div>
          <div className="flex justify-between border-b border-gray-50 pb-1">
            <span className="font-bold text-gray-400">رقم الهاتف:</span>
            <span className="font-mono font-semibold text-gray-900" dir="ltr">{data.phone ?? "غير مدون"}</span>
          </div>
          <div className="flex justify-between border-b border-gray-50 pb-1">
            <span className="font-bold text-gray-400">العنوان:</span>
            <span className="font-semibold text-gray-900 line-clamp-1 max-w-[70%]">{data.address ?? "غير مدون"}</span>
          </div>
          <div className="flex justify-between border-b border-gray-50 pb-1">
            <span className="font-bold text-gray-400">الأوراق:</span>
            <span className={`font-semibold ${data.documentsProvided ? 'text-green-600' : 'text-red-500'}`}>
              {data.documentsProvided ? "مكتملة" : "ناقصة"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-1.5 text-[9px] text-gray-400">
          <span>مؤسسة اللواء الخيرية للتنمية</span>
          <span>كود العائلة: {data.familyCode || "عام"}</span>
        </div>
      </div>
    </div>
  );
}
