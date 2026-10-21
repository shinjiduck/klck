// Biểu tượng và màu theo lớp Hue Map (FR-F8-01).
// AC-F8.1-05: khách sạn và homestay dùng biểu tượng khác nhau.

import { Camera, Hotel, House, Landmark, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import type { LodgingType, Place, PlaceLayer } from "@/lib/types";

type Kind = PlaceLayer | LodgingType;

const ICON: Record<Kind, LucideIcon> = {
  heritage: Landmark,
  attraction: Camera,
  food: UtensilsCrossed,
  stay: Hotel,
  hotel: Hotel,
  homestay: House,
};

/** Nền đậm cho ghim. */
export const KIND_BG: Record<Kind, string> = {
  heritage: "bg-amber-700",
  attraction: "bg-sky-600",
  food: "bg-rose-600",
  stay: "bg-violet-600",
  hotel: "bg-violet-600",
  homestay: "bg-emerald-600",
};

/** Nền nhạt cho ảnh giữ chỗ và icon trong danh sách. */
export const KIND_SOFT: Record<Kind, string> = {
  heritage: "bg-amber-100 text-amber-800",
  attraction: "bg-sky-100 text-sky-800",
  food: "bg-rose-100 text-rose-800",
  stay: "bg-violet-100 text-violet-800",
  hotel: "bg-violet-100 text-violet-800",
  homestay: "bg-emerald-100 text-emerald-800",
};

export function placeKind(p: Pick<Place, "layer" | "lodging_type">): Kind {
  return p.layer === "stay" && p.lodging_type ? p.lodging_type : p.layer;
}

export function KindIcon({ kind, className }: { kind: Kind; className?: string }) {
  const Icon = ICON[kind];
  return <Icon className={cn("size-4", className)} aria-hidden />;
}
