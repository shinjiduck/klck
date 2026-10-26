"use client";

// Khung nội dung theo trang: điện thoại luôn 390px (ưu tiên mobile).
// Màn hình rộng (≥ 1024px): Hue Map dùng toàn màn hình (AC-F8.1-04 – danh sách thành cột bên cạnh),
// các trang khác giữ cột hẹp ở giữa cho dễ đọc.

import { usePathname } from "next/navigation";
import { cn } from "cn";

export function RouteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullWidth = pathname === "/map" || pathname.startsWith("/map/");
  return <div className={cn("relative h-full", !fullWidth && "lg:mx-auto lg:max-w-[480px]")}>{children}</div>;
}
