// Layout chung phía du khách: khung điện thoại 390px (ưu tiên mobile) + thanh điều hướng dưới.

import { BottomNav } from "@/components/bottom-nav";

export default function TravelerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-[390px] flex-col overflow-hidden bg-background shadow-xl">
      <main className="relative min-h-0 flex-1">{children}</main>
      <BottomNav />
    </div>
  );
}
