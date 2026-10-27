// Lịch chi tiết của một phương án, theo ngày.
// AC-F1-03: mỗi mục có địa điểm, giờ bắt đầu–kết thúc, thời gian di chuyển, chi phí ước tính,
// nguồn và ngày cập nhật. Dùng ở UX-04 (xem chi tiết phương án) và tab "Lịch của tôi".

import { Car, Navigation, Trash2 } from "lucide-react";
import { cn } from "cn";
import { KIND_SOFT, KindIcon, placeKind } from "@/components/layer-icon";
import { WEEKDAY_SHORT } from "@/lib/labels";
import { directionsUrl, fmtMin, formatUpdatedMonth, formatVnd, weekdayOf } from "@/lib/places";
import type { ConstraintIssue, LatLng, Place, PlanDay, PlannedItemKind } from "@/lib/types";

const KIND_LABEL: Record<PlannedItemKind, string> = {
  visit: "Tham quan",
  meal: "Ăn",
  cafe: "Cà phê",
  evening: "Buổi tối",
};

function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}

function mealLabel(start: number) {
  return start < 15 * 60 ? "Ăn trưa" : "Ăn tối";
}

export function dayLabel(day: PlanDay) {
  const [, m, d] = day.date.split("-");
  return `Ngày ${day.day_no} · ${WEEKDAY_SHORT[weekdayOf(day.date)]} ${d}/${m}`;
}

export function PlanTimeline({
  day,
  placesById,
  issues = [],
  onRemove,
  directions,
}: {
  day: PlanDay;
  placesById: Map<string, Place>;
  issues?: ConstraintIssue[];
  /** Có thì hiện nút xóa từng mục (tab "Lịch của tôi"). */
  onRemove?: (index: number) => void;
  /** Có thì mỗi chặng di chuyển là nút chỉ đường Google Maps; origin = nơi ở (null = vị trí hiện tại). */
  directions?: { origin: LatLng | null };
}) {
  return (
    <ol className="relative space-y-3 border-l border-dashed border-border pl-4">
      {day.items.map((item, i) => {
        const place = placesById.get(item.place_id);
        if (!place) return null;
        const kind = placeKind(place);
        const problem = issues.find(
          (x) => x.severity === "error" && x.place_id === place.id && (x.day_no == null || x.day_no === day.day_no),
        );
        const price =
          item.est_cost_vnd == null
            ? "Chưa rõ giá"
            : item.est_cost_vnd === 0
              ? "Miễn phí"
              : `~${formatVnd(item.est_cost_vnd)}/người${place.price_status === "estimated" ? " (ước tính)" : ""}`;
        const prev = day.items[i - 1];
        const freeMin = prev ? item.start_min - (prev.start_min + prev.duration_min) - item.travel_min : 0;
        return (
          <li key={`${item.place_id}-${i}`} className="relative">
            {freeMin >= 60 && (
              <p className="mb-1 text-[11px] font-medium text-emerald-700">Thời gian tự do ~{formatDuration(freeMin)}</p>
            )}
            <span
              className={cn(
                "absolute top-1 -left-[25px] flex size-4 items-center justify-center rounded-full border-2 border-background",
                problem ? "bg-destructive" : "bg-primary",
              )}
              aria-hidden
            />
            {item.travel_min > 0 &&
              (directions ? (
                // Chỉ đường chặng này: từ điểm trước (điểm đầu ngày: từ nơi ở, chưa chọn thì vị trí hiện tại).
                <a
                  href={directionsUrl(place.location, {
                    origin: (prev && placesById.get(prev.place_id)?.location) || directions.origin || undefined,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-1 inline-flex items-center gap-1 rounded-full bg-primary/8 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/15"
                >
                  <Navigation className="size-3" aria-hidden />
                  Di chuyển ~{item.travel_min} phút · Chỉ đường
                </a>
              ) : (
                <p className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Car className="size-3" aria-hidden />
                  Di chuyển ~{item.travel_min} phút
                </p>
              ))}
            <div className={cn("rounded-lg border p-2.5", problem && "border-destructive/50 bg-destructive/5")}>
              <div className="flex items-start gap-2.5">
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", KIND_SOFT[kind])}>
                  <KindIcon kind={kind} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {fmtMin(item.start_min)}–{fmtMin(item.start_min + item.duration_min)} ·{" "}
                    {item.kind === "meal" ? mealLabel(item.start_min) : KIND_LABEL[item.kind]}
                  </p>
                  <p className="truncate text-sm font-medium">{place.name}</p>
                  <p className="text-xs text-muted-foreground">{price}</p>
                  {problem && <p className="mt-1 text-xs font-medium text-destructive">{problem.message}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Nguồn: {place.source} · Cập nhật {formatUpdatedMonth(place.updated_at)}
                  </p>
                </div>
                {onRemove && (
                  <button
                    type="button"
                    aria-label={`Xóa ${place.name} khỏi lịch`}
                    title="Xóa khỏi lịch"
                    onClick={() => onRemove(i)}
                    className="-mt-1 -mr-1 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
