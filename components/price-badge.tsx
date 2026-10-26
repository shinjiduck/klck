// AC-F3-03 / FR-F3-03: thẻ gợi ý ăn, ở luôn ghi rõ một trong ba trạng thái giá.

import { cn } from "cn";
import { PRICE_STATUS_LABEL, getPriceValue } from "@/lib/places";
import type { Place } from "@/lib/types";

const TONE: Record<Place["price_status"], string> = {
  estimated: "bg-sky-50 text-sky-800 ring-sky-200",
  confirmed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  unknown: "bg-muted text-muted-foreground ring-border",
};

export function PriceBadge({ place, className }: { place: Place; className?: string }) {
  const value = getPriceValue(place);
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5 text-xs", className)}>
      {place.price_status !== "unknown" && <span className="font-medium">{value}</span>}
      <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium ring-1", TONE[place.price_status])}>
        {PRICE_STATUS_LABEL[place.price_status]}
      </span>
    </span>
  );
}
