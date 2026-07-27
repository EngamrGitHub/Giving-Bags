"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeProps {
  value: string;
  width?: number;
  height?: number;
  fontSize?: number;
}

/** يرسم صورة باركود (Code128) على canvas بناءً على القيمة المعطاة */
export default function Barcode({
  value,
  width = 2,
  height = 60,
  fontSize = 16,
}: BarcodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      JsBarcode(canvasRef.current, value, {
        format: "CODE128",
        width,
        height,
        fontSize,
        margin: 8,
        background: "#ffffff",
        lineColor: "#111827",
      });
    } catch (err) {
      console.error("تعذر توليد الباركود:", err);
    }
  }, [value, width, height, fontSize]);

  return <canvas ref={canvasRef} role="img" aria-label={`باركود: ${value}`} />;
}
