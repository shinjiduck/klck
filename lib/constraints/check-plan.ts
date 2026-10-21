// Constraint Engine GĐ1 – kiểm tra lịch trước khi gắn "Khả thi".
// FR-F1-04, AC-F1-04, BR-FEAS-01 (tính khả thi do code quyết định, không do AI).
// Kiểm tra: giờ mở cửa theo thứ của ngày đi, chồng giờ, đủ thời gian di chuyển, trùng điểm,
// điểm bắt buộc có trong lịch. Dùng lại cho UX-05 Xung đột khi thêm điểm từ bản đồ (AC-F8.3-02, 03).

import { WEEKDAY_SHORT } from "@/lib/labels";
import { estimateTravel, fmtMin, getOpenRanges, weekdayOf } from "@/lib/places";
import type { ConstraintIssue, Place, PlanDay } from "@/lib/types";

/** Khoảng sai số cho phép khi so thời gian di chuyển (phút). */
const TRAVEL_TOLERANCE_MIN = 5;

export function checkPlan(
  days: PlanDay[],
  placesById: Map<string, Place>,
  mustHaveIds: string[],
): ConstraintIssue[] {
  const issues: ConstraintIssue[] = [];
  const seenInTrip = new Map<string, number>();

  for (const day of days) {
    const weekday = weekdayOf(day.date);
    const seenInDay = new Set<string>();

    day.items.forEach((item, i) => {
      const place = placesById.get(item.place_id);
      if (!place) return;
      const start = item.start_min;
      const end = start + item.duration_min;

      // Giờ mở cửa
      const ranges = getOpenRanges(place, weekday);
      if (ranges == null) {
        issues.push({
          code: "UNKNOWN_HOURS",
          severity: "warning",
          day_no: day.day_no,
          place_id: place.id,
          message: `Chưa rõ giờ mở cửa của ${place.name}.`,
        });
      } else if (ranges.length === 0) {
        issues.push({
          code: "CLOSED",
          severity: "error",
          day_no: day.day_no,
          place_id: place.id,
          message: `${place.name} nghỉ vào ${WEEKDAY_SHORT[weekday]} ${day.date.slice(8, 10)}/${day.date.slice(5, 7)}.`,
        });
      } else if (!ranges.some(([s, e]) => start >= s && end <= e)) {
        const hours = ranges.map(([s, e]) => `${fmtMin(s)}–${fmtMin(e)}`).join(", ");
        issues.push({
          code: "CLOSED",
          severity: "error",
          day_no: day.day_no,
          place_id: place.id,
          message: `${place.name} mở ${hours}, nhưng lịch là ${fmtMin(start)}–${fmtMin(end)}.`,
        });
      }

      // Trùng điểm trong ngày (lỗi) / điểm tham quan lặp lại ở ngày khác (lưu ý; ăn lại quán cũ thì bình thường)
      if (seenInDay.has(place.id)) {
        issues.push({
          code: "DUPLICATE",
          severity: "error",
          day_no: day.day_no,
          place_id: place.id,
          message: `${place.name} xuất hiện 2 lần trong ngày ${day.day_no}.`,
        });
      } else if (seenInTrip.has(place.id) && (item.kind === "visit" || item.kind === "evening")) {
        issues.push({
          code: "DUPLICATE",
          severity: "warning",
          day_no: day.day_no,
          place_id: place.id,
          message: `${place.name} đã có ở ngày ${seenInTrip.get(place.id)}.`,
        });
      }
      seenInDay.add(place.id);
      if (!seenInTrip.has(place.id)) seenInTrip.set(place.id, day.day_no);

      // Chồng giờ và thời gian di chuyển so với mục trước
      const prev = day.items[i - 1];
      const prevPlace = prev && placesById.get(prev.place_id);
      if (prev && prevPlace) {
        const prevEnd = prev.start_min + prev.duration_min;
        const need = estimateTravel(prevPlace.location, place.location).minutes;
        if (start < prevEnd) {
          issues.push({
            code: "OVERLAP",
            severity: "error",
            day_no: day.day_no,
            place_id: place.id,
            message: `${place.name} (${fmtMin(start)}) chồng giờ với ${prevPlace.name} (đến ${fmtMin(prevEnd)}).`,
          });
        } else if (start - prevEnd + TRAVEL_TOLERANCE_MIN < need) {
          issues.push({
            code: "TRAVEL_TIME",
            severity: "error",
            day_no: day.day_no,
            place_id: place.id,
            message: `Từ ${prevPlace.name} đến ${place.name} cần khoảng ${need} phút, lịch chỉ để ${start - prevEnd} phút.`,
          });
        }
      }
    });
  }

  for (const id of mustHaveIds) {
    if (!seenInTrip.has(id)) {
      const name = placesById.get(id)?.name ?? "Một điểm bắt buộc";
      issues.push({
        code: "MUST_HAVE_MISSING",
        severity: "error",
        place_id: id,
        message: `${name} là điểm bắt buộc nhưng chưa có trong lịch.`,
      });
    }
  }

  return issues;
}

export function isFeasible(issues: ConstraintIssue[]): boolean {
  return !issues.some((i) => i.severity === "error");
}
