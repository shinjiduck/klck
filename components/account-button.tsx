"use client";

// Nút tài khoản nhỏ ở đầu các màn lịch trình: Đăng nhập (quay về đúng trang) / email + Đăng xuất.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { signOut, useAuth } from "@/lib/auth";

export function AccountButton({ className }: { className?: string }) {
  const auth = useAuth();
  const pathname = usePathname();

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
