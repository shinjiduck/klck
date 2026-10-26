// F3 – Gợi ý ăn uống và lưu trú theo tuyến (UC-06, UX-07).
// FR-F3-01 / AC-F3-01: quán theo khung giờ ăn, độ lệch khỏi tuyến, giờ mở cửa, ngân sách; áp dụng chế độ ăn
//   nếu người dùng đã khai (BR-PREF-02).
// FR-F3-02 / AC-F3-02: nơi ở xét TOÀN BỘ lịch trình (không chỉ vị trí hiện tại), hiển thị thời gian di chuyển/ngày.
// AC-F3-04 / BR-MAP-05: kết quả tài trợ tách riêng, có nhãn, không được cộng điểm hay trộn vào xếp hạng tự nhiên.
// Hàm thuần – dùng lại được ở Route Handler GET /api/trips/{id}/suggestions?type=food|stay.

import { estimateTravel, fmtMin, getOpenRanges, weekdayOf } from "@/lib/places";
import { MEAL_CAP, STAY_CAP, tripOrigin } from "@/lib/reco/generate-plans";
import type { LatLng, Place, PlanDay, TripInput } from "@/lib/types";

const MEAL_DURATION = 60;
const ceil5 = (m: number) => Math.ceil(m / 5) * 5;

// ---------------------------------------------------------------------
// Ăn uống
// ---------------------------------------------------------------------

export type MealSlot = {
  key: "lunch" | "dinner";
  label: string;
  day_no: number;
  /** Giờ bắt đầu dự kiến của bữa. */
  start_min: number;
  /** Mục ăn đang có trong lịch (để thay thế); null = bữa này chưa có quán. */
  current: { index: number; place_id: string } | null;
  /** Điểm ngay trước / sau bữa ăn trên tuyến (null = đầu / cuối ngày). */
  prev: LatLng | null;
  next: LatLng | null;
};

const WINDOWS = [
  { key: "lunch" as const, label: "Bữa trưa", from: 11 * 60, to: 14 * 60, default: 11 * 60 + 30 },
  { key: "dinner" as const, label: "Bữa tối", from: 17 * 60 + 30, to: 21 * 60, default: 18 * 60 },
];

/** Các bữa trong một ngày: bữa đã có quán (để đổi) hoặc khoảng trống theo khung giờ ăn. */
export function mealSlots(day: PlanDay, byId: Map<string, Place>, origin: LatLng): MealSlot[] {
  const items = [...day.items].sort((a, b) => a.start_min - b.start_min);
  const loc = (i: number) => (i < 0 ? origin : (byId.get(items[i]?.place_id)?.location ?? null));

  return WINDOWS.map((w) => {
    const idx = items.findIndex((it) => it.kind === "meal" && it.start_min >= w.from && it.start_min < w.to);
    if (idx >= 0) {
      return {
        key: w.key,
        label: w.label,
        day_no: day.day_no,
        start_min: items[idx].start_min,
        current: { index: idx, place_id: items[idx].place_id },
        prev: loc(idx - 1),
        next: idx + 1 < items.length ? loc(idx + 1) : null,
      };
    }
    // Chưa có bữa: chèn sau mục cuối cùng kết thúc trước khung giờ.
    let prevIdx = -1;
    items.forEach((it, i) => {
      if (it.start_min + it.duration_min <= w.default + 30) prevIdx = i;
    });
    const prevEnd = prevIdx >= 0 ? items[prevIdx].start_min + items[prevIdx].duration_min : w.default;
    return {
      key: w.key,
      label: w.label,
      day_no: day.day_no,
      start_min: ceil5(Math.max(w.default, prevEnd)),
      current: null,
      prev: loc(prevIdx),
      next: prevIdx + 1 < items.length ? loc(prevIdx + 1) : null,
    };
  });
}

export type FoodSuggestion = {
  place: Place;
  start_min: number;
  /** Số phút đi thêm so với đi thẳng từ điểm trước tới điểm sau (độ lệch tuyến). */
  detour_min: number;
  hours: "open" | "unknown";
  reasons: string[];
};

export type Suggestions<T> = { items: T[]; sponsored: T[] };

export function suggestFood(
  slot: MealSlot,
  input: TripInput,
  date: string,
  places: Place[],
  limit = 3,
): Suggestions<FoodSuggestion> {
  const weekday = weekdayOf(date);
  const veg = input.dietary.includes("vegetarian");
  const cap = MEAL_CAP[input.budget_level];
  const prev = slot.prev;

  const all: (FoodSuggestion & { score: number })[] = [];
  for (const p of places) {
    if (p.layer !== "food" || p.primary_category_id === "cat-cafe") continue;
    if (p.id === slot.current?.place_id) continue;
    if (veg && p.vegetarian_friendly !== true) continue; // AC-F3-01: áp dụng chế độ ăn đã khai
    if (p.price_min_vnd != null && p.price_min_vnd > cap) continue;

    const start = slot.start_min;
    const ranges = getOpenRanges(p, weekday);
    let hours: FoodSuggestion["hours"] = "unknown";
    if (ranges) {
      const fits = ranges.find(([s, e]) => start >= s && start + MEAL_DURATION <= e);
      if (!fits) continue; // đóng cửa trong khung giờ ăn → loại
      hours = "open";
    }

    // Độ lệch tuyến tính theo quãng đường (km) rồi đổi ra phút ở 20 km/h – không cộng 10 phút dự phòng
    // của từng chặng, nếu không sẽ bị tính dư một lần dự phòng khi so với đi thẳng.
    const km = (a: LatLng | null, b: LatLng | null) => (a && b ? estimateTravel(a, b).km : 0);
    const detourKm = km(prev, p.location) + km(p.location, slot.next) - km(prev, slot.next);
    const detour = Math.max(0, Math.round((detourKm / 20) * 60));

    const reasons = [`Lệch tuyến +${detour} phút`];
    if (hours === "open") {
      const r = ranges!.find(([s, e]) => start >= s && start + MEAL_DURATION <= e)!;
      reasons.push(`Mở cửa đến ${fmtMin(r[1])}`);
    } else reasons.push("Chưa rõ giờ mở cửa");
    if (veg) reasons.push("Có món chay");
    if (p.price_min_vnd != null && Number.isFinite(cap)) reasons.push("Trong ngân sách");

    let score = -detour;
    if (hours === "unknown") score -= 8;
    if (input.interests.includes("food") && p.highlight_tags.includes("local_food")) score += 5;
    all.push({ place: p, start_min: start, detour_min: detour, hours, reasons, score });
  }

  all.sort((a, b) => b.score - a.score);
  // AC-F3-04: tài trợ tách riêng, không trộn vào xếp hạng tự nhiên.
  const strip = (x: FoodSuggestion & { score: number }): FoodSuggestion => ({
    place: x.place,
    start_min: x.start_min,
    detour_min: x.detour_min,
    hours: x.hours,
    reasons: x.reasons,
  });
  return {
    items: all.filter((x) => !x.place.is_sponsored).slice(0, limit).map(strip),
    sponsored: all.filter((x) => x.place.is_sponsored).slice(0, 1).map(strip),
  };
}

// ---------------------------------------------------------------------
// Lưu trú
// ---------------------------------------------------------------------

export type StaySuggestion = {
  place: Place;
  /** Phút di chuyển từ nơi ở tới điểm đầu + từ điểm cuối về nơi ở, từng ngày. */
  per_day: { day_no: number; minutes: number }[];
  avg_per_day: number;
  total_min: number;
  reasons: string[];
};

export function suggestStay(
  days: PlanDay[],
  input: TripInput,
  places: Place[],
  filter: { lodging?: Place["lodging_type"][] } = {},
  limit = 5,
): Suggestions<StaySuggestion> {
  const byId = new Map(places.map((p) => [p.id, p]));
  const cap = STAY_CAP[input.budget_level];

  const all: StaySuggestion[] = [];
  for (const p of places) {
    if (p.layer !== "stay") continue;
    if (filter.lodging?.length && (!p.lodging_type || !filter.lodging.includes(p.lodging_type))) continue;
    if (p.price_min_vnd != null && p.price_min_vnd > cap) continue;

    // AC-F3-02: tính trên toàn bộ lịch trình.
    const per_day = days.map((d) => {
      const items = [...d.items].sort((a, b) => a.start_min - b.start_min);
      const first = byId.get(items[0]?.place_id);
      const last = byId.get(items[items.length - 1]?.place_id);
      const minutes =
        (first ? estimateTravel(p.location, first.location).minutes : 0) +
        (last ? estimateTravel(last.location, p.location).minutes : 0);
      return { day_no: d.day_no, minutes };
    });
    const total = per_day.reduce((s, x) => s + x.minutes, 0);
    const avg = Math.round(total / Math.max(1, per_day.length));
    const reasons = [`Đi lại ~${avg} phút/ngày theo lịch của bạn`];
    if (p.price_min_vnd != null && Number.isFinite(cap)) reasons.push("Trong ngân sách");
    if (p.highlight_tags.includes("river_view")) reasons.push("Gần sông Hương");
    all.push({ place: p, per_day, avg_per_day: avg, total_min: total, reasons });
  }

  all.sort((a, b) => a.total_min - b.total_min);
  return {
    items: all.filter((x) => !x.place.is_sponsored).slice(0, limit),
    sponsored: all.filter((x) => x.place.is_sponsored).slice(0, 1),
  };
}

/** Tên điểm xuất phát mỗi ngày để hiển thị: nơi ở đã chọn hoặc "trung tâm Huế". */
export function originLabel(input: TripInput, byId: Map<string, Place>): string {
  const stay = input.stay_place_id ? byId.get(input.stay_place_id) : undefined;
  return stay ? stay.name : "trung tâm Huế";
}

/** Điểm xuất phát (vị trí) – tiện cho giao diện gọi mealSlots. */
export function originOf(input: TripInput, byId: Map<string, Place>): LatLng {
  return tripOrigin(input, byId);
}
