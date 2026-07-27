"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import SyncStatus from "./SyncStatus";

const links = [
  { href: "/dashboard", label: "المستفيدون" },
  { href: "/dashboard/families", label: "العائلات والمخصصات" },
  { href: "/dashboard/new", label: "إضافة مستفيد" },
  { href: "/dashboard/scan", label: "تسليم الشنط والمساعدات" },
  { href: "/dashboard/users", label: "إدارة الحسابات" },
];

export default function Navbar({ orgName }: { orgName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("تم تسجيل الخروج");
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="no-print sticky top-0 z-10 border-b border-gray-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="شعار مؤسسة اللواء" className="h-10 w-auto object-contain" />
            <span className="font-bold text-gray-900">{orgName}</span>
          </div>
          <SyncStatus />
        </div>

        <nav className="flex flex-wrap items-center gap-1">
          {links.map((link) => {
            const active =
              link.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-brand-50 text-brand-700 font-bold"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <button onClick={handleLogout} className="btn-danger mr-1 text-xs">
            تسجيل خروج
          </button>
        </nav>
      </div>
    </header>
  );
}
