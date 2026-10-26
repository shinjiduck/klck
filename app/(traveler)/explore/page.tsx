// Tab "Khám phá": UC-01 Xem lịch mẫu (FR-F1-01) + bộ sưu tập địa điểm theo chủ đề.
// Khách xem không cần tài khoản. Sự kiện, Quest, trải nghiệm địa phương (F7, F4, F6) sẽ thêm vào đây ở GĐ2.

import type { Metadata } from "next";
import { getPublishedPlaces } from "@/lib/data/places";
import { ExploreView } from "./_components/explore-view";

export const metadata: Metadata = { title: "Khám phá · HueTrip" };

export default async function ExplorePage() {
  const places = await getPublishedPlaces();
  return <ExploreView places={places} />;
}
