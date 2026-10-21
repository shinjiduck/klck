// Giữ chỗ cho tab "Khám phá" (chưa có màn tương ứng trong SRS).

import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Khám phá · HueTrip" };

export default function ExplorePage() {
  return <ComingSoon icon={Compass} title="Khám phá" text="Đang phát triển." />;
}
