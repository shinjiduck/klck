// Khu vực Admin GĐ1 (UX-A1 → A5) – chỉ dành cho máy tính.
// AC-ROLE-03: chưa đăng nhập → chuyển tới trang đăng nhập; đăng nhập nhưng không phải admin/biên tập viên →
// "Bạn không có quyền truy cập". Kiểm tra ở server (đọc cookie phiên) – không dựa vào việc ẩn menu.
// Cookie chỉ có lúc request nên phần kiểm tra nằm trong <Suspense> (Cache Components).

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ShieldX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ROLE_LABEL } from "@/lib/admin-types";
import { requireRole } from "@/lib/supabase/guard";
import { AdminNav } from "./_components/admin-nav";

export const metadata: Metadata = { title: "Quản trị · HueTrip" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Đang kiểm tra quyền…</div>}>
        <Gate>{children}</Gate>
      </Suspense>
    </div>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  const g = await requireRole("staff");
  if (!g.ok) {
    if (g.status === 401) redirect("/login?next=/admin");
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-8 text-center">
        <ShieldX className="size-10 text-destructive" aria-hidden />
        <h1 className="text-lg font-semibold">{g.status === 503 ? "Chưa cấu hình Supabase" : "Bạn không có quyền truy cập"}</h1>
        <p className="text-sm text-muted-foreground">Khu vực này chỉ dành cho quản trị viên và biên tập viên.</p>
        <Link href="/map" className={buttonVariants({ variant: "outline" })}>
          Về Hue Map
        </Link>
      </div>
    );
  }
  return (
    <div className="flex min-h-dvh">
      <AdminNav role={g.ctx.role} email={g.ctx.user.email ?? ""} roleLabel={ROLE_LABEL[g.ctx.role]} />
      <main className="min-w-0 flex-1 px-8 py-6">{children}</main>
    </div>
  );
}
