// Tab "Lịch của tôi" – UX-06 Lịch ngày: phương án đã chọn ở UX-04 (bản nháp trên trình duyệt),
// xóa điểm, mở tuyến trên Hue Map.

import type { Metadata } from "next";
import { getPublishedPlaces } from "@/lib/data/places";
import { MyTrip } from "./_components/my-trip";

export const metadata: Metadata = { title: "Lịch của tôi · HueTrip" };

export default async function TripPage() {
  const places = await getPublishedPlaces();
  return <MyTrip places={places} />;
}
