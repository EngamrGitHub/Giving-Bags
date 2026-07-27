"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

interface CameraScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose?: () => void;
}

export default function CameraScanner({
  onScanSuccess,
  onClose,
}: CameraScannerProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "html5qr-code-full-region";

  useEffect(() => {
    let isMounted = true;
    const html5QrcodeScanner = new Html5Qrcode(containerId, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.UPC_A,
      ],
      verbose: false,
    });
    scannerRef.current = html5QrcodeScanner;

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    };

    async function startCamera() {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (!isMounted) return;

        if (!devices || devices.length === 0) {
          setErrorMsg("لم يتم العثور على أي كاميرا متصلة بهذا الجهاز.");
          return;
        }

        // محاولة استخدام الكاميرا الخلفية إن وجدت، وإلا استخدام أول كاميرا متاحة (مثل كاميرا اللاب توب)
        const backCamera = devices.find(
          (d) =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("rear") ||
            d.label.toLowerCase().includes("environment")
        );
        const cameraId = backCamera ? backCamera.id : devices[0].id;

        await html5QrcodeScanner.start(
          cameraId,
          config,
          (decodedText) => {
            if (isMounted) {
              onScanSuccess(decodedText);
              html5QrcodeScanner.stop().catch(() => {});
            }
          },
          () => {}
        );

        if (isMounted) setIsScanning(true);
      } catch (err: any) {
        if (!isMounted) return;
        console.warn("Primary camera start failed, trying fallback...", err);

        // محاولة Fallback باستخدام facingMode
        try {
          await html5QrcodeScanner.start(
            { facingMode: "user" },
            config,
            (decodedText) => {
              if (isMounted) {
                onScanSuccess(decodedText);
                html5QrcodeScanner.stop().catch(() => {});
              }
            },
            () => {}
          );
          if (isMounted) setIsScanning(true);
        } catch (fallbackErr: any) {
          if (!isMounted) return;
          console.error("Camera access error:", fallbackErr);
          if (
            fallbackErr?.name === "NotFoundError" ||
            fallbackErr?.toString().includes("NotFoundError")
          ) {
            setErrorMsg(
              "لم يتم العثور على كاميرا متصلة بهذا الجهاز. يمكنك استخدام قارئ الباركود أو إدخال الكود يدويًا."
            );
          } else if (
            fallbackErr?.name === "NotAllowedError" ||
            fallbackErr?.toString().includes("NotAllowedError")
          ) {
            setErrorMsg(
              "تم رفض إذن الوصول للكاميرا. يرجى السماح للمتصفح بالوصول للكاميرا من إعدادات الموقع."
            );
          } else {
            setErrorMsg("تعذر فتح الكاميرا على هذا الجهاز.");
          }
        }
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScanSuccess]);

  const handleStop = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
    }
    if (onClose) onClose();
  };

  return (
    <div className="relative rounded-xl border border-gray-200 bg-white p-4 shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isScanning && (
            <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
          )}
          <h3 className="text-sm font-bold text-gray-800">
            {isScanning
              ? "جاري المسح بواسطة الكاميرا..."
              : "جاري تشغيل الكاميرا..."}
          </h3>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={handleStop}
            className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200"
          >
            إغلاق الكاميرا
          </button>
        )}
      </div>

      {errorMsg ? (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-center text-sm font-medium text-amber-800">
          {errorMsg}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-black">
          <div id={containerId} className="w-full" />
        </div>
      )}

      <p className="mt-2 text-center text-xs text-gray-500">
        وجّه الكاميرا نحو الـ QR Code أو الباركود المطبوع على كارت المستفيد
      </p>
    </div>
  );
}
