// UX-07 Gợi ý ăn uống, lưu trú theo tuyến (frame "07 AN O"). UC-06. FR-F3-01 → 03, AC-F3-01 → 04.

import type { Metadata } from "next";
import { Suspense } from "react";
import { getPublishedPlaces } from "@/lib/data/places";
import { SuggestView } from "./_components/suggest-view";

export const metadata: Metadata = { title: "Gợi ý ăn, ở · HueTrip" };

export default async function SuggestPage() {
  const places = await getPublishedPlaces();
  return (
    // SuggestView đọc ?type= và ?day= (useSearchParams) nên cần Suspense.
    <Suspense>
      <SuggestView places={places} />
    </Suspense>
  );
}
