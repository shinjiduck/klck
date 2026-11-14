"use client";

// Nút tài khoản nhỏ ở đầu các màn lịch trình: Đăng nhập (quay về đúng trang) / email + Đăng xuất.
// Tài khoản editor/admin thấy thêm nút "Quản trị" → /admin. Chỉ là lối tắt: quyền vẫn kiểm tra ở server
// (app/admin/layout.tsx) và RLS, không dựa vào việc ẩn/hiện nút này.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogIn, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { signOut, useAuth } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AccountButton({ className }: { className?: string }) {
  const auth = useAuth();
  const pathname = usePathname();
  const userId = auth.status === "signed_in" ? auth.user.id : null;
  // Gắn với userId để đổi tài khoản thì không dùng lại kết quả cũ.
  const [staff, setStaff] = useState<{ userId: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    getSupabaseBrowserClient()
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setStaff({ userId, ok: data?.role === "admin" || data?.role === "editor" });
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const isStaff = staff != null && staff.userId === userId && staff.ok;

  if (auth.status === "disabled" || auth.status === "loading") return null;

  if (auth.status === "signed_out") {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(pathname)}`}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), className)}
      >
        <LogIn data-icon="inline-start" />
        Đăng nhập
      </Link>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <UserRound className="size-3.5 shrink-0" aria-hidden />
      <span className="max-w-[9rem] truncate" title={auth.user.email ?? undefined}>
        {auth.user.email}
      </span>
      {isStaff && (
        <Link
          href="/admin"
          title="Khu vực quản trị"
          className="flex items-center gap-1 rounded-md px-1.5 py-1 font-medium text-foreground hover:bg-muted"
        >
          <LayoutDashboard className="size-3.5" aria-hidden />
          Quản trị
        </Link>
      )}
      <Link
        href="/privacy"
        title="Quyền riêng tư"
        aria-label="Quyền riêng tư"
        className="flex items-center rounded-md px-1.5 py-1 text-foreground hover:bg-muted"
      >
        <ShieldCheck className="size-3.5" aria-hidden />
      </Link>
      <button
        type="button"
        onClick={async () => {
          await signOut();
          toast.success("Đã đăng xuất");
        }}
        className="flex items-center gap-1 rounded-md px-1.5 py-1 font-medium text-foreground hover:bg-muted"
      >
        <LogOut className="size-3.5" aria-hidden />
        Đăng xuất
      </button>
    </div>
  );
}
