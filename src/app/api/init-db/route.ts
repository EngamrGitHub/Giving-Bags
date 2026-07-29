import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    // 1. إنشاء جداول قاعدة البيانات بـ SQL المباشر على السيرفر فوراً بدون الاعتماد على CLI
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT PRIMARY KEY,
        "email" TEXT UNIQUE,
        "username" TEXT UNIQUE,
        "password" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'STAFF',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Family" (
        "id" TEXT PRIMARY KEY,
        "familyCode" TEXT NOT NULL UNIQUE,
        "familyName" TEXT NOT NULL,
        "bagsCount" INTEGER NOT NULL DEFAULT 1,
        "cashAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Beneficiary" (
        "id" TEXT PRIMARY KEY,
        "fullName" TEXT NOT NULL,
        "age" INTEGER NOT NULL,
        "nationalId" TEXT NOT NULL UNIQUE,
        "phone" TEXT NOT NULL,
        "address" TEXT NOT NULL,
        "barcode" TEXT NOT NULL UNIQUE,
        "notes" TEXT,
        "isFamilyHead" BOOLEAN NOT NULL DEFAULT false,
        "documentsProvided" BOOLEAN NOT NULL DEFAULT false,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "familyId" TEXT REFERENCES "Family"("id") ON DELETE SET NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Redemption" (
        "id" TEXT PRIMARY KEY,
        "beneficiaryId" TEXT NOT NULL REFERENCES "Beneficiary"("id") ON DELETE CASCADE,
        "familyId" TEXT REFERENCES "Family"("id") ON DELETE SET NULL,
        "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
        "month" INTEGER NOT NULL,
        "year" INTEGER NOT NULL,
        "bagsDelivered" INTEGER NOT NULL DEFAULT 1,
        "cashDelivered" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "redeemedBy" TEXT,
        CONSTRAINT "Redemption_beneficiaryId_month_year_key" UNIQUE ("beneficiaryId", "month", "year")
      );
    `);

    // 2. إنشاء/تحديث حساب الأدمن الرئيسي
    const envUser = process.env.ADMIN_USERNAME || "admin";
    const envPass = process.env.ADMIN_PASSWORD || "admin123";
    const hashedPassword = await bcrypt.hash(envPass, 10);

    const createdAdmin = await prisma.user.upsert({
      where: { username: envUser },
      update: {},
      create: {
        username: envUser,
        name: "مدير النظام",
        password: hashedPassword,
        role: "ADMIN",
        email: "admin@ellwaa.org",
      },
    });

    return NextResponse.json({
      success: true,
      message: "✅ تم إنشاء جميع جداول الهيكل (User, Family, Beneficiary, Redemption) وحساب المدير بنجاح!",
      adminUsername: createdAdmin.username,
    });
  } catch (err: any) {
    console.error("Init DB Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: "فشلت تهيئة جداول قاعدة البيانات",
        details: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
