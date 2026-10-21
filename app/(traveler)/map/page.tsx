// UX-02 Hue Map + UX-03 Thẻ địa điểm. UC-02, UC-03. FR-F8-01 → 09.
// Dữ liệu: lib/data/places.ts (Supabase nếu đã cấu hình, ngược lại dữ liệu giả).

import type { Metadata } from "next";
import { Suspense } from "react";
import { getCategories, getPublishedPlaces } from "@/lib/data/places";
import { HueMap } from "./_components/hue-map";

export const metadata: Metadata = { title: "Hue Map · HueTrip" };

export default async function MapPage() {
  const [places, categories] = await Promise.all([getPublishedPlaces(), getCategories()]);
  return (
    // HueMap đọc bộ lọc từ URL (useSearchParams) nên cần Suspense.
    <Suspense fallback={<div className="absolute inset-0 animate-pulse bg-muted" />}>
      <HueMap places={places} categories={categories} />
    </Suspense>
  );
}
