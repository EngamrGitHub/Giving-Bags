import { PrismaClient } from "@prisma/client";
import { customAlphabet } from "nanoid";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const nanoid = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 8);

async function main() {
  console.log("🌱 جاري تهيئة البيانات والمستخدمين...");

  // 1. إضافة حساب Admin افتراضي إن لم يكن موجودًا
  const adminEmail = process.env.ADMIN_EMAIL || "admin@ellwaa.org";
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  // فحص بالبريد الإيميل أو الاسم
  let existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [{ email: adminEmail }, { username: adminUsername }],
    },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    existingAdmin = await prisma.user.create({
      data: {
        email: adminEmail,
        username: adminUsername,
        password: hashedPassword,
        name: "مدير النظام (Admin)",
        role: "ADMIN",
      },
    });
    console.log(`✅ تم إنشاء حساب المدير الافتراضي: ${adminEmail} / ${adminPassword}`);
  }

  // 2. إنشاء عائلات تجريبية
  const code1 = `FAM-${Math.floor(10000 + Math.random() * 90000)}`;
  const code2 = `FAM-${Math.floor(10000 + Math.random() * 90000)}`;

  const sampleFamilies = [
    {
      key: "FAM-1001",
      familyCode: code1,
      familyName: "عائلة آل عبد الله",
      bagsCount: 2,
      cashAmount: 500,
      notes: "عائلة مكونة من 5 أفراد",
    },
    {
      key: "FAM-1002",
      familyCode: code2,
      familyName: "عائلة آل السيد",
      bagsCount: 1,
      cashAmount: 300,
      notes: "أرملة وكبار سن",
    },
  ];

  const createdFamilies: Record<string, string> = {};
  for (const f of sampleFamilies) {
    let fam = await prisma.family.findUnique({
      where: { familyCode: f.familyCode },
    });
    if (!fam) {
      const { key, ...data } = f;
      fam = await prisma.family.create({ data });
    }
    createdFamilies[f.key] = fam.id;
  }

  // 3. إضافة مستفيدين وربطهم بالعائلات
  const sampleBeneficiaries = [
    {
      fullName: "أحمد محمود عبد الله",
      age: 45,
      nationalId: "28501011234567",
      phone: "01012345678",
      address: "العمرانية الشرقية، الجيزة",
      familyId: createdFamilies["FAM-1001"],
      isFamilyHead: true,
    },
    {
      fullName: "فاطمة السيد حسن",
      age: 60,
      nationalId: "26303151234567",
      phone: "01123456789",
      address: "شارع الهرم، الجيزة",
      familyId: createdFamilies["FAM-1002"],
      isFamilyHead: true,
    },
    {
      fullName: "محمد علي إبراهيم",
      age: 38,
      nationalId: "29807201234567",
      phone: "01234567890",
      address: "فيصل، الجيزة",
      familyId: createdFamilies["FAM-1001"],
      isFamilyHead: false,
    },
  ];

  const usedBarcodes = new Set<string>();
  for (const person of sampleBeneficiaries) {
    const existing = await prisma.beneficiary.findUnique({
      where: { nationalId: person.nationalId },
    });
    if (existing) continue;

    let barcode = "";
    while (true) {
      const digits = Math.floor(10000 + Math.random() * 90000);
      const candidate = `USER-${digits}`;
      if (!usedBarcodes.has(candidate)) {
        barcode = candidate;
        usedBarcodes.add(candidate);
        break;
      }
    }

    await prisma.beneficiary.create({
      data: { ...person, barcode },
    });
  }

  console.log("✅ تم الانتهاء من تهيئة البيانات التجريبية والعائلات");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
