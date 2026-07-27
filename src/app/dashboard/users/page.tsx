"use client";

import { useEffect, useState, FormEvent } from "react";
import toast from "react-hot-toast";

interface UserItem {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "STAFF";
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"STAFF" | "ADMIN">("STAFF");

  async function fetchUsers() {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "خطأ في جلب المستخدمين");
      } else {
        setUsers(data.users || []);
      }
    } catch {
      toast.error("تعذر الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  function openCreateModal() {
    setEditingUser(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("STAFF");
    setShowModal(true);
  }

  function openEditModal(user: UserItem) {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setPassword(""); // نترك كلمة السر فارغة لتعديل البيانات بدون تغيير كلمة السر ما لم يدخل كلمة جديدة
    setRole(user.role);
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload = { name, email, password, role };
    const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
    const method = editingUser ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "فشل حفظ بيانات الحساب");
      } else {
        toast.success(
          editingUser
            ? `تم تعديل حساب ${data.user.name} بنجاح`
            : `تم إنشاء حساب ${data.user.name} بنجاح`
        );
        setShowModal(false);
        fetchUsers();
      }
    } catch {
      toast.error("حدث خطأ أثناء الاتصال");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(user: UserItem) {
    if (!confirm(`هل أنت تأكد من مسح حساب "${user.name}" (${user.email})؟`)) return;

    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.success("تم مسح الحساب بنجاح");
        fetchUsers();
      } else {
        toast.error(data.error || "فشل مسح الحساب");
      }
    } catch {
      toast.error("خطأ في الاتصال");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">إدارة الحسابات وصلاحيات المدير (CRUD)</h1>
          <p className="mt-1 text-sm text-gray-500">
            إنشاء، عرض، تعديل، ومسح حسابات الموظفين والمتطوعين (Admin / Staff)
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn-primary"
        >
          إضافة حساب جديد
        </button>
      </div>

      {/* Modal إضافة أو تعديل حساب */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">
                {editingUser ? `تعديل حساب: ${editingUser.name}` : "إنشاء حساب مستخدم جديد"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label-field">الاسم الكامل</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: محمد أحمد - مسؤول التوزيع"
                />
              </div>

              <div>
                <label className="label-field">البريد الإلكتروني / اسم الدخول</label>
                <input
                  type="email"
                  required
                  className="input-field"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@ellwaa.org"
                />
              </div>

              <div>
                <label className="label-field">
                  {editingUser ? "كلمة المرور الجديدة (اتركها فارغة للتعديل بدون تغيير)" : "كلمة المرور"}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  minLength={6}
                  className="input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingUser ? "•••••••• (اتركها فارغة لإبقاء الحالية)" : "******"}
                />
              </div>

              <div>
                <label className="label-field">نوع الصلاحية (Role)</label>
                <select
                  className="input-field"
                  value={role}
                  onChange={(e) => setRole(e.target.value as "STAFF" | "ADMIN")}
                >
                  <option value="STAFF">موظف / متطوع (Staff - توزيع واستلام)</option>
                  <option value="ADMIN">مدير النظام (Admin - تحكم كامل)</option>
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                >
                  {submitting ? "جاري الحفظ..." : editingUser ? "حفظ التعديلات" : "إنشاء الحساب"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* جدول الحسابات */}
      <div className="card-surface p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">جاري تحميل الحسابات...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">لا يوجد حسابات مسجلة بعد</div>
        ) : (
          <table className="w-full text-right text-sm text-gray-700">
            <thead className="border-b bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3">الاسم</th>
                <th className="px-4 py-3">البريد الإلكتروني</th>
                <th className="px-4 py-3">الصلاحية</th>
                <th className="px-4 py-3">تاريخ الإنشاء</th>
                <th className="px-4 py-3 text-center">الإجراءات (CRUD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/80 transition">
                  <td className="px-4 py-3.5 font-bold text-gray-900">{u.name}</td>
                  <td className="px-4 py-3.5 text-gray-600" dir="ltr">{u.email}</td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
                        u.role === "ADMIN"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {u.role === "ADMIN" ? "مدير (Admin)" : "متطوع (Staff)"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-400">
                    {new Date(u.createdAt).toLocaleDateString("ar-EG")}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEditModal(u)}
                        className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                      >
                        مسح
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
