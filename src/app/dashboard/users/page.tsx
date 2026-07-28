"use client";

import { useEffect, useState, FormEvent } from "react";
import toast from "react-hot-toast";

interface UserItem {
  id: string;
  email: string | null;
  username: string | null;
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
  const [username, setUsername] = useState("");
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
    setUsername("");
    setPassword("");
    setRole("STAFF");
    setShowModal(true);
  }

  function openEditModal(user: UserItem) {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email || "");
    setUsername(user.username || "");
    setPassword("");
    setRole(user.role);
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Client-side validation
    if (!name.trim() || name.trim().length < 2) {
      toast.error("الاسم مطلوب (حرفين على الأقل)");
      return;
    }
    if (role === "STAFF" && (!username.trim() || username.trim().length < 3)) {
      toast.error("اسم المستخدم مطلوب (3 حروف على الأقل)");
      return;
    }
    if (role === "ADMIN" && !email.trim()) {
      toast.error("البريد الإلكتروني مطلوب لحساب المدير");
      return;
    }
    if (!editingUser && password.trim().length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 حروف على الأقل");
      return;
    }
    if (editingUser && password.trim() && password.trim().length < 6) {
      toast.error("كلمة المرور الجديدة يجب أن تكون 6 حروف على الأقل");
      return;
    }

    setSubmitting(true);

    const payload = {
      name,
      email: role === "ADMIN" ? email : undefined,
      username: role === "STAFF" ? username : undefined,
      password,
      role,
    };

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
    const label = user.username ? `@${user.username}` : user.email || user.name;
    if (!confirm(`هل أنت متأكد من مسح حساب "${user.name}" (${label})؟`)) return;

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
          <h1 className="text-xl font-bold text-gray-900">إدارة الحسابات</h1>
          <p className="mt-1 text-sm text-gray-500">
            إنشاء، عرض، تعديل، ومسح حسابات الموظفين والمدراء
          </p>
        </div>
        <button onClick={openCreateModal} className="btn-primary">
          + إضافة حساب جديد
        </button>
      </div>

      {/* ── Modal إضافة / تعديل ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">
                {editingUser ? `تعديل: ${editingUser.name}` : "إنشاء حساب جديد"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-700 text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* الاسم */}
              <div>
                <label className="label-field">الاسم الكامل</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="محمد أحمد"
                />
              </div>

              {/* نوع الصلاحية */}
              <div>
                <label className="label-field">نوع الصلاحية</label>
                <select
                  className="input-field"
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value as "STAFF" | "ADMIN");
                    setEmail("");
                    setUsername("");
                  }}
                >
                  <option value="STAFF">موظف / متطوع — توزيع واستلام</option>
                  <option value="ADMIN">مدير النظام — تحكم كامل</option>
                </select>
              </div>

              {/* STAFF ← username */}
              {role === "STAFF" && (
                <div>
                  <label className="label-field">اسم المستخدم (للدخول)</label>
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 select-none font-mono text-sm text-gray-400">
                      @
                    </span>
                    <input
                      type="text"
                      required
                      className="input-field pr-7"
                      dir="ltr"
                      value={username}
                      onChange={(e) =>
                        setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))
                      }
                      placeholder="ahmed_staff"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">
                    حروف إنجليزية وأرقام و _ فقط
                  </p>
                </div>
              )}

              {/* ADMIN ← email */}
              {role === "ADMIN" && (
                <div>
                  <label className="label-field">البريد الإلكتروني</label>
                  <input
                    type="email"
                    required
                    className="input-field"
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@ellwaa.org"
                  />
                </div>
              )}

              {/* كلمة المرور */}
              <div>
                <label className="label-field">
                  {editingUser
                    ? "كلمة المرور الجديدة (اتركها فارغة لإبقاء الحالية)"
                    : "كلمة المرور"}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  minLength={6}
                  className="input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingUser ? "•••••• (اختياري)" : "••••••"}
                />
              </div>

              <div className="mt-2 flex justify-end gap-3 border-t pt-4">
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
                  {submitting
                    ? "جاري الحفظ..."
                    : editingUser
                      ? "حفظ التعديلات"
                      : "إنشاء الحساب"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── جدول الحسابات ── */}
      <div className="card-surface overflow-hidden p-0">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">
            جاري تحميل الحسابات...
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            لا يوجد حسابات مسجلة بعد
          </div>
        ) : (
          <table className="w-full text-right text-sm text-gray-700">
            <thead className="border-b bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3">الاسم</th>
                <th className="px-4 py-3">بيانات الدخول</th>
                <th className="px-4 py-3">الصلاحية</th>
                <th className="px-4 py-3">تاريخ الإنشاء</th>
                <th className="px-4 py-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="transition hover:bg-gray-50/80">
                  <td className="px-4 py-3.5 font-bold text-gray-900">{u.name}</td>
                  <td className="px-4 py-3.5" dir="ltr">
                    {u.username ? (
                      <span className="rounded bg-brand-50 px-2 py-0.5 font-mono text-xs text-brand-700">
                        @{u.username}
                      </span>
                    ) : u.email ? (
                      <span className="text-xs text-gray-600">{u.email}</span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${u.role === "ADMIN"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                        }`}
                    >
                      {u.role === "ADMIN" ? "مدير (Admin)" : "موظف (Staff)"}
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
