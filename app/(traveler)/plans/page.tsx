// UX-04 Chọn 1 trong 3 phương án (frame "04 3 PHUONG AN"). UC-04 bước 2–5. FR-F1-03, FR-F1-04, AC-F1-02 → 04.

import type { Metadata } from "next";
import { getPublishedPlaces } from "@/lib/data/places";
import { PlansView } from "./_components/plans-view";

export const metadata: Metadata = { title: "3 phương án · HueTrip" };

export default async function PlansPage() {
  const places = await getPublishedPlaces();
  return <PlansView places={places} />;
}
