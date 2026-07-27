"use client";

import { useEffect } from "react";

/**
 * تسجيل صريح لـ Service Worker. next-pwa بيسجله تلقائيًا برضه،
 * لكن الكومبوننت ده ضمان إضافي يشتغل مع App Router بشكل موثوق،
 * وميعملش أي حاجة في وضع التطوير (SW متعطل هناك أصلًا).
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // مفيش داعي نزعج المستخدم لو التسجيل فشل، الموقع هيشتغل عادي أونلاين
      });
    }
  }, []);

  return null;
}
