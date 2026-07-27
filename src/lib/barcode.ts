import { customAlphabet } from "nanoid";

// أبجدية بدون أحرف متشابهة (0/O, 1/I) لتقليل الأخطاء عند القراءة اليدوية
const nanoid = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 10);

/** توليد كود فريد لكل مستفيد يُستخدم كباركود على الكارت */
export function generateBarcodeValue(): string {
  return `BAG-${nanoid()}`;
}
