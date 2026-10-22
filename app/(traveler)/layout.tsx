// Layout chung phía du khách: khung điện thoại 390px (ưu tiên mobile) + thanh điều hướng dưới.
// Có Supabase: gắn TripSync để đồng bộ chuyến đi khi đăng nhập/đăng xuất.

import { BottomNav } from "@/components/bottom-nav";
import { TripSync } from "@/components/trip-sync";
import { getPublishedPlaces } from "@/lib/data/places";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function TravelerLayout({ children }: { children: React.ReactNode }) {
  const places = isSupabaseConfigured ? await getPublishedPlaces() : [];
  return (
    <div className="mx-auto flex h-dvh w-full max-w-[390px] flex-col overflow-hidden bg-background shadow-xl">
      {isSupabaseConfigured && <TripSync places={places} />}
      <main className="relative min-h-0 flex-1">{children}</main>
      <BottomNav />
    </div>
  );
}
