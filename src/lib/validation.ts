import { z } from "zod";

/** بيانات المستفيد عند الإضافة أو التعديل */
export const beneficiarySchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "الاسم يجب ألا يقل عن 3 أحرف")
    .max(100, "الاسم طويل جدًا"),
  age: z.coerce
    .number({ invalid_type_error: "السن يجب أن يكون رقمًا" })
    .int("السن يجب أن يكون رقمًا صحيحًا")
    .min(0, "السن غير صحيح")
    .max(120, "السن غير صحيح"),
  nationalId: z
    .string()
    .trim()
    .regex(/^\d{14}$/, "الرقم القومي يجب أن يتكون من 14 رقمًا"),
  phone: z
    .string()
    .trim()
    .regex(/^01[0-2,5]{1}[0-9]{8}$/, "رقم الموبايل غير صحيح (مثال: 01012345678)"),
  address: z
    .string()
    .trim()
    .max(300, "العنوان طويل جدًا")
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  familyId: z.string().optional().nullable(),
  isFamilyHead: z.boolean().default(false),
  documentsProvided: z.boolean().default(false),
  barcode: z
    .string()
    .trim()
    .regex(/^USER-[0-9]{5}$/)
    .optional(),
});

export type BeneficiaryInput = z.infer<typeof beneficiarySchema>;

export const loginSchema = z.object({
  username: z.string().min(1, "اسم المستخدم مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

export const redeemSchema = z.object({
  barcode: z.string().trim().min(1, "الباركود مطلوب"),
  redeemedBy: z.string().trim().max(100).optional().or(z.literal("")),
  customBags: z.coerce.number().min(0).optional(),
  customCash: z.coerce.number().min(0).optional(),
});
