// Sửa lịch từ bản đồ: thêm / xóa điểm, gợi ý khung giờ trống, xem trước xung đột.
// FR-F8-08, AC-F8.3-02 (cảnh báo trùng trong ngày), AC-F8.3-03 (xung đột + cách xử lý),
// AC-F8.3-04 (cập nhật lịch, tuyến không tải lại trang), AC-F8.3-05 (hỏi ngày, gợi ý khung giờ trống).
// Hàm thuần; Constraint Engine là nơi duy nhất quyết định có xung đột hay không (BR-FEAS-01).

import { HUE_CENTER, estimateTravel, fmtMin, getOpenRanges, weekdayOf } from "@/lib/places";
import { evaluateDays, tripOrigin } from "@/lib/reco/generate-plans";
import type { ConstraintIssue, GeneratedPlan, LatLng, Place, PlanDay, PlannedItem, PlannedItemKind, TripInput } from "@/lib/types";

/** Giờ muộn nhất một mục được kết thúc khi gợi ý khung giờ. */
const LATEST_END = 22 * 60;
const EARLIEST_START = 7 * 60;

const ceil5 = (m: number) => Math.ceil(m / 5) * 5;

export function defaultDuration(place: Place): number {
  if (place.layer === "food") return place.primary_category_id === "cat-cafe" ? 45 : 60;
  if (place.layer === "stay") return 30;
  return place.visit_duration_min ?? 60;
}

function kindFor(place: Place, start: number): PlannedItemKind {
  if (place.layer === "food") return place.primary_category_id === "cat-cafe" ? "cafe" : "meal";
  if (start >= 19 * 60) return "evening";
  return "visit";
}

/** Tính lại thời gian di chuyển giữa các mục theo thứ tự (mục đầu đi từ nơi ở / trung tâm Huế). */
function relink(items: PlannedItem[], byId: Map<string, Place>, origin: LatLng = HUE_CENTER): PlannedItem[] {
  const sorted = [...items].sort((a, b) => a.start_min - b.start_min);
  return sorted.map((it, i) => {
    const from = i === 0 ? origin : byId.get(sorted[i - 1].place_id)?.location ?? origin;
    const to = byId.get(it.place_id)?.location ?? HUE_CENTER;
    return { ...it, travel_min: estimateTravel(from, to).minutes };
  });
}

export type Slot = { start_min: number; end_min: number; label: string };

/**
 * Khung giờ trống trong ngày phù hợp giờ mở cửa và đủ thời gian đi tới / đi tiếp (AC-F8.3-05).
 * Trả tối đa `limit` khung, sớm nhất trước.
 */
export function suggestSlots(
  day: PlanDay,
  place: Place,
  byId: Map<string, Place>,
  limit = 3,
  origin: LatLng = HUE_CENTER,
): Slot[] {
  const dur = defaultDuration(place);
  const ranges = getOpenRanges(place, weekdayOf(day.date)) ?? [[EARLIEST_START, LATEST_END]];
  const items = [...day.items].sort((a, b) => a.start_min - b.start_min);
  const slots: Slot[] = [];

  for (let i = 0; i <= items.length; i++) {
    const prev = items[i - 1];
    const next = items[i];
    const prevPlace = prev ? byId.get(prev.place_id) : undefined;
    const nextPlace = next ? byId.get(next.place_id) : undefined;
    if (prev?.place_id === place.id || next?.place_id === place.id) continue;

    const from = prevPlace?.location ?? origin;
    const earliest = prev ? prev.start_min + prev.duration_min + estimateTravel(from, place.location).minutes : EARLIEST_START;
    const latestEnd = next && nextPlace ? next.start_min - estimateTravel(place.location, nextPlace.location).minutes : LATEST_END;

    for (const [open, close] of ranges) {
      const start = ceil5(Math.max(earliest, open));
      const end = start + dur;
      if (end <= Math.min(close, latestEnd)) {
        const where = prevPlace ? `sau ${prevPlace.name}` : nextPlace ? `trước ${nextPlace.name}` : "trong ngày";
        slots.push({ start_min: start, end_min: end, label: `${fmtMin(start)}–${fmtMin(end)} · ${where}` });
        break;
      }
    }
  }
  return slots.slice(0, limit);
}

export type InsertPreview = {
  plan: GeneratedPlan;
  /** Xung đột mức "error" liên quan tới điểm vừa thêm hoặc mục ngay sau nó trong ngày đó. */
  conflicts: ConstraintIssue[];
  /** Điểm đã có trong cùng ngày (AC-F8.3-02). */
  duplicateInDay: boolean;
};

/** Xem trước kết quả khi thêm `place` vào `dayNo` lúc `startMin`, chưa lưu. */
export function previewInsert(
  plan: GeneratedPlan,
  input: TripInput,
  byId: Map<string, Place>,
  place: Place,
  dayNo: number,
  startMin: number,
): InsertPreview {
  const day = plan.days.find((d) => d.day_no === dayNo);
  if (!day) throw new Error(`Không có ngày ${dayNo}`);
  const duplicateInDay = day.items.some((i) => i.place_id === place.id);

  const newItem: PlannedItem = {
    place_id: place.id,
    kind: kindFor(place, startMin),
    day_no: dayNo,
    start_min: startMin,
    duration_min: defaultDuration(place),
    travel_min: 0,
    est_cost_vnd: estimateCost(place),
  };
  const items = relink([...day.items, newItem], byId, tripOrigin(input, byId));
  const days = plan.days.map((d) => (d.day_no === dayNo ? { ...d, items } : d));
  const next = { ...plan, ...evaluateDays(days, input, byId) };

  // Mục đứng ngay sau điểm mới cũng có thể bị ảnh hưởng (chồng giờ, thiếu thời gian di chuyển).
  const idx = items.findIndex((x) => x.place_id === place.id && x.start_min === startMin);
  const affected = new Set([place.id, items[idx + 1]?.place_id].filter(Boolean) as string[]);
  const before = new Set(plan.issues.filter((i) => i.severity === "error").map((i) => i.message));
  const conflicts = next.issues.filter(
    (i) =>
      i.severity === "error" &&
      i.day_no === dayNo &&
      (!i.place_id || affected.has(i.place_id)) &&
      !before.has(i.message),
  );
  return { plan: next, conflicts, duplicateInDay };
}

export function removeItem(
  plan: GeneratedPlan,
  input: TripInput,
  byId: Map<string, Place>,
  dayNo: number,
  index: number,
): GeneratedPlan {
  const days = plan.days.map((d) =>
    d.day_no === dayNo ? { ...d, items: relink(d.items.filter((_, i) => i !== index), byId, tripOrigin(input, byId)) } : d,
  );
  return { ...plan, ...evaluateDays(days, input, byId) };
}

function estimateCost(p: Place): number | null {
  if (p.layer === "stay") return null; // giá phòng không cộng vào chi phí/người của lịch
  if (p.price_min_vnd == null && p.price_max_vnd == null) return null;
  const lo = p.price_min_vnd ?? p.price_max_vnd ?? 0;
  const hi = p.price_max_vnd ?? lo;
  return Math.round((lo + hi) / 2);
}

/**
 * Đổi nơi ở (F3, UX-07): tính lại thời gian đi từ nơi ở tới điểm đầu mỗi ngày và kiểm tra lại lịch.
 * Trả về đầu vào mới (có stay_place_id) và lịch đã tính lại.
 */
export function applyStay(
  plan: GeneratedPlan,
  input: TripInput,
  byId: Map<string, Place>,
  stayPlaceId: string | null,
): { input: TripInput; plan: GeneratedPlan } {
  const nextInput = { ...input, stay_place_id: stayPlaceId };
  const origin = tripOrigin(nextInput, byId);
  const days = plan.days.map((d) => ({ ...d, items: relink(d.items, byId, origin) }));
  return { input: nextInput, plan: { ...plan, ...evaluateDays(days, nextInput, byId) } };
}
