import { openDB, DBSchema, IDBPDatabase } from "idb";

/**
 * تخزين محلي (IndexedDB) يستخدم فقط في المتصفح للسماح بالعمل
 * بدون إنترنت: تسليم الشنط وإضافة مستفيدين بيتسجلوا محليًا هنا
 * أول ما مفيش اتصال، وبعدين بيتزامنوا مع السيرفر تلقائيًا.
 */

export interface PendingRedemption {
  localId: string;
  barcode: string;
  redeemedBy: string;
  createdAt: string;
  status: "pending" | "conflict" | "error";
  message?: string;
}

export interface PendingBeneficiary {
  localId: string;
  payload: {
    fullName: string;
    age: string;
    nationalId: string;
    phone: string;
    address: string;
    notes: string;
    documentsProvided?: boolean;
    familyId?: string;
    isFamilyHead?: boolean;
  };
  localBarcode: string;
  createdAt: string;
  status: "pending" | "conflict" | "error";
  message?: string;
}

export interface CachedBeneficiary {
  id: string;
  fullName: string;
  age: number;
  nationalId: string;
  phone: string;
  address: string;
  barcode: string;
  isActive: boolean;
  redeemedThisMonth: boolean;
  redeemedMonthKey: string; // "2026-7" مثلا، عشان نعرف الكاش ده لأي شهر
  family?: {
    familyCode: string;
    familyName: string;
  } | null;
}

interface OfflineDBSchema extends DBSchema {
  pendingRedemptions: {
    key: string;
    value: PendingRedemption;
  };
  pendingBeneficiaries: {
    key: string;
    value: PendingBeneficiary;
  };
  beneficiaryCache: {
    key: string;
    value: CachedBeneficiary;
    indexes: { byBarcode: string; byNationalId: string };
  };
  meta: {
    key: string;
    value: { key: string; value: string };
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineDBSchema>> | null = null;

function getDb() {
  if (typeof window === "undefined") {
    throw new Error("offlineDb لا يعمل إلا داخل المتصفح");
  }
  if (!dbPromise) {
    dbPromise = openDB<OfflineDBSchema>("bags-offline-db", 1, {
      upgrade(db) {
        db.createObjectStore("pendingRedemptions", { keyPath: "localId" });
        db.createObjectStore("pendingBeneficiaries", { keyPath: "localId" });
        const cacheStore = db.createObjectStore("beneficiaryCache", {
          keyPath: "id",
        });
        cacheStore.createIndex("byBarcode", "barcode", { unique: true });
        cacheStore.createIndex("byNationalId", "nationalId", { unique: true });
        db.createObjectStore("meta", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}`;
}

/* ---------------------- كاش المستفيدين (للعرض والبحث بدون نت) ---------------------- */

export async function replaceBeneficiaryCache(items: CachedBeneficiary[]) {
  const db = await getDb();
  const tx = db.transaction("beneficiaryCache", "readwrite");
  await tx.store.clear();
  for (const item of items) {
    await tx.store.put(item);
  }
  await tx.done;
}

export async function upsertCachedBeneficiary(item: CachedBeneficiary) {
  const db = await getDb();
  await db.put("beneficiaryCache", item);
}

export async function getCachedBeneficiaries(): Promise<CachedBeneficiary[]> {
  const db = await getDb();
  const items = await db.getAll("beneficiaryCache");
  const curKey = currentMonthKey();
  return items.map((item) => ({
    ...item,
    redeemedThisMonth: item.redeemedMonthKey === curKey ? item.redeemedThisMonth : false,
  }));
}

export async function findCachedByBarcode(
  barcode: string
): Promise<CachedBeneficiary | undefined> {
  const db = await getDb();
  const item = await db.getFromIndex("beneficiaryCache", "byBarcode", barcode);
  if (!item) return undefined;
  const curKey = currentMonthKey();
  return {
    ...item,
    redeemedThisMonth: item.redeemedMonthKey === curKey ? item.redeemedThisMonth : false,
  };
}

export async function markCachedAsRedeemed(id: string) {
  const db = await getDb();
  const item = await db.get("beneficiaryCache", id);
  if (item) {
    item.redeemedThisMonth = true;
    item.redeemedMonthKey = currentMonthKey();
    await db.put("beneficiaryCache", item);
  }
}

/* ---------------------- طابور تسليم الشنط أوفلاين ---------------------- */

export async function queueRedemption(
  data: Omit<PendingRedemption, "localId" | "status" | "createdAt">
): Promise<PendingRedemption> {
  const db = await getDb();
  const entry: PendingRedemption = {
    localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    status: "pending",
    ...data,
  };
  await db.put("pendingRedemptions", entry);
  return entry;
}

export async function getPendingRedemptions(): Promise<PendingRedemption[]> {
  const db = await getDb();
  return db.getAll("pendingRedemptions");
}

export async function removePendingRedemption(localId: string) {
  const db = await getDb();
  await db.delete("pendingRedemptions", localId);
}

export async function updatePendingRedemption(entry: PendingRedemption) {
  const db = await getDb();
  await db.put("pendingRedemptions", entry);
}

/* ---------------------- طابور إضافة مستفيدين أوفلاين ---------------------- */

export async function queueBeneficiary(
  data: Omit<PendingBeneficiary, "localId" | "status" | "createdAt">
): Promise<PendingBeneficiary> {
  const db = await getDb();
  const entry: PendingBeneficiary = {
    localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    status: "pending",
    ...data,
  };
  await db.put("pendingBeneficiaries", entry);
  return entry;
}

export async function getPendingBeneficiaries(): Promise<PendingBeneficiary[]> {
  const db = await getDb();
  return db.getAll("pendingBeneficiaries");
}

export async function removePendingBeneficiary(localId: string) {
  const db = await getDb();
  await db.delete("pendingBeneficiaries", localId);
}

export async function updatePendingBeneficiary(entry: PendingBeneficiary) {
  const db = await getDb();
  await db.put("pendingBeneficiaries", entry);
}

/* ---------------------- عدد العناصر اللي مستنية المزامنة ---------------------- */

export async function getPendingCount(): Promise<number> {
  const [redemptions, beneficiaries] = await Promise.all([
    getPendingRedemptions(),
    getPendingBeneficiaries(),
  ]);
  return redemptions.length + beneficiaries.length;
}
