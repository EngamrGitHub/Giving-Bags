/** توليد كود فريد لكل مستفيد يُستخدم كباركود على الكارت */
export function generateBarcodeValue(): string {
  const digits = Math.floor(10000 + Math.random() * 90000); // 10000 to 99999
  return `USER-${digits}`;
}
