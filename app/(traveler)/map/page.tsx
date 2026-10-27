// UX-02 Hue Map + UX-03 Thẻ địa điểm. UC-02, UC-03. FR-F8-01 → 09.
// Dữ liệu: lib/data/places.ts (Supabase nếu đã cấu hình, ngược lại dữ liệu giả).

import type { Metadata } from "next";
import { Suspense } from "react";
import { getCategories, getPublishedPlaces } from "@/lib/data/places";
import { HueMap } from "./_components/hue-map";

export const metadata: Metadata = { title: "Hue Map · HueTrip" };

async function MapData() {
  const [places, categories] = await Promise.all([getPublishedPlaces(), getCategories()]);
  return <HueMap places={places} categories={categories} />;
}

export default function MapPage() {
  return (
    // Tải dữ liệu + HueMap đọc bộ lọc từ URL (useSearchParams) đều nằm trong Suspense.
    <Suspense fallback={<div className="absolute inset-0 animate-pulse bg-muted" />}>
      <MapData />
    </Suspense>
  );
}
