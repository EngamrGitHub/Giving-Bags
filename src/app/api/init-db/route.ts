import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
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
      message: "✅ تم اختبار الاتصال بقاعدة البيانات بنجاح وإنشاء حساب المدير!",
      adminUsername: createdAdmin.username,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: "تعذر الاتصال بقاعدة البيانات PostgreSQL",
        details: err?.message || String(err),
        hint: "تأكد من ضبط متغير DATABASE_URL الصحيح داخل قسم Environment Variables في Coolify",
      },
      { status: 500 }
    );
  }
}
