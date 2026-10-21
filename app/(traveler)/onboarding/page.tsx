// UX-01 Khai sở thích, thiết lập chuyến đi (frame "01 SOTHICH"). UC-04 bước 1. FR-F1-01, FR-F1-02, AC-F1-01.

import type { Metadata } from "next";
import { getPublishedPlaces } from "@/lib/data/places";
import { OnboardingForm } from "./_components/onboarding-form";

export const metadata: Metadata = { title: "Lên lịch trình · HueTrip" };

export default async function OnboardingPage() {
  // Điểm có thể chọn làm "điểm bắt buộc": di tích và điểm du lịch.
  const places = await getPublishedPlaces();
  const sights = places
    .filter((p) => p.layer === "heritage" || p.layer === "attraction")
    .map((p) => ({ id: p.id, name: p.name, layer: p.layer }));
  return <OnboardingForm sights={sights} />;
}
