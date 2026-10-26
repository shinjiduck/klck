"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileUp, History, MapPinned, Users, ArrowLeft } from "lucide-react";
import { cn } from "cn";
import type { AppRole } from "@/lib/admin-types";

const ITEMS = [
  { href: "/admin/places", label: "Địa điểm", icon: MapPinned, admin: false },
  { href: "/admin/import", label: "Nhập CSV", icon: FileUp, admin: false },
  { href: "/admin/users", label: "Người dùng", icon: Users, admin: true },
  { href: "/admin/audit", label: "Nhật ký thao tác", icon: History, admin: true },
];

export function AdminNav({ role, email, roleLabel }: { role: AppRole; email: string; roleLabel: string }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col border-r bg-muted/40 p-4">
      <p className="text-lg font-semibold">HueTrip Admin</p>
      <p className="mt-1 truncate text-xs text-muted-foreground" title={email}>
        {email} · {roleLabel}
      </p>
      <nav className="mt-6 space-y-1">
        {/* Menu chỉ để tiện dùng; quyền thật được kiểm tra ở API và RLS (SEC-ROLE-05). */}
        {ITEMS.filter((i) => !i.admin || role === "admin").map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
              pathname.startsWith(href) ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:bg-background",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
      <Link href="/map" className="mt-auto flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Về Hue Map
      </Link>
    </aside>
  );
}
