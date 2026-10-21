// Sinh 3 phương án lịch (UC-04, FR-F1-03, AC-F1-02, AC-F1-03).
// Quy trình theo SRS: lọc điểm phù hợp → chấm điểm → xếp lịch → Constraint Engine kiểm tra.
// Lý do dùng câu mẫu theo reason code (AC-F8.4-05: nối với lựa chọn của người dùng);
// sau này Claude API chỉ viết lại câu chữ, không đổi kết quả (BR-FEAS-01).
// Chưa chọn nơi ở (F3) nên mỗi ngày giả định xuất phát từ trung tâm Huế.

import { checkPlan, isFeasible } from "@/lib/constraints/check-plan";
import { BUDGET_LABEL, INTEREST_LABEL, PLAN_TITLE, TRAVEL_WITH_LABEL } from "@/lib/labels";
import { HUE_CENTER, addDays, estimateTravel, formatVnd, getOpenRanges, haversineKm, weekdayOf } from "@/lib/places";
import type {
  BudgetLevel,
  ConstraintIssue,
  GeneratedPlan,
  Interest,
  LatLng,
  MatchReason,
  Pace,
  Place,
  PlanDay,
  PlannedItem,
  PlannedItemKind,
  PlanType,
  TripInput,
  Weekday,
} from "@/lib/types";

export const RULE_VERSION = "gd1-rules-2026.10.1";

const DAY_START = 8 * 60;
const LUNCH_FROM = 11 * 60 + 15;
const LUNCH_LATEST = 13 * 60;
const CAFE_FROM = 14 * 60 + 30;
const DINNER_FROM = 18 * 60;
const MAX_SIGHTS_PER_DAY = 5;

const MEAL_DURATION = { meal: 60, cafe: 45 } as const;

/** Trần giá một bữa/người theo mức ngân sách (giá thấp nhất của quán). */
const MEAL_CAP: Record<BudgetLevel, number> = { saving: 60_000, moderate: 250_000, comfortable: Infinity };
/** Mức chi tiêu/người/ngày (chưa gồm lưu trú, di chuyển) để cảnh báo vượt ngân sách. */
const DAILY_CAP: Record<BudgetLevel, number> = { saving: 400_000, moderate: 900_000, comfortable: Infinity };

const BASE_SIGHTS: Record<Pace, number> = { relaxed: 2, normal: 3, packed: 4 };

type PlanConfig = {
  weight: { heritage: number; attraction: number };
  /** Cộng/trừ số điểm tham quan mỗi ngày so với nhịp độ. */
  sightDelta: number;
  cafe: boolean;
  evening: boolean;
};

const CONFIG: Record<PlanType, PlanConfig> = {
  heritage: { weight: { heritage: 3, attraction: 0.5 }, sightDelta: 0, cafe: false, evening: false },
  balanced: { weight: { heritage: 1.6, attraction: 1.8 }, sightDelta: 0, cafe: false, evening: true },
  food_relax: { weight: { heritage: 1, attraction: 1.5 }, sightDelta: -1, cafe: true, evening: true },
};

const PLAN_ORDER: PlanType[] = ["heritage", "balanced", "food_relax"];

const isEveningSpot = (p: Place) => p.highlight_tags.includes("nightlife") && p.layer !== "food";
const isSight = (p: Place) => p.layer === "heritage" || p.layer === "attraction";
const ceil5 = (m: number) => Math.ceil(m / 5) * 5;

function priceEstimate(p: Place): number | null {
  if (p.price_min_vnd == null && p.price_max_vnd == null) return null;
  const lo = p.price_min_vnd ?? p.price_max_vnd ?? 0;
  const hi = p.price_max_vnd ?? lo;
  return Math.round((lo + hi) / 2);
}

function fitsOpen(p: Place, day: Weekday, start: number, dur: number): "yes" | "no" | "unknown" {
  const ranges = getOpenRanges(p, day);
  if (ranges == null) return "unknown";
  return ranges.some(([s, e]) => start >= s && start + dur <= e) ? "yes" : "no";
}

/** Nếu đến sớm hơn giờ mở cửa thì chờ tới giờ mở. */
function alignToOpen(p: Place, day: Weekday, arrival: number): number {
  const ranges = getOpenRanges(p, day);
  if (!ranges || ranges.length === 0) return arrival;
  const next = ranges.find(([, e]) => arrival < e);
  return next ? Math.max(arrival, next[0]) : arrival;
}

function sightScore(p: Place, cfg: PlanConfig, input: TripInput): number {
  let s = p.layer === "heritage" ? cfg.weight.heritage : cfg.weight.attraction;
  const tags = p.highlight_tags;
  if (input.interests.includes("heritage") && p.layer === "heritage") s += 1.5;
  if (input.interests.includes("photo") && tags.includes("photo_spot")) s += 1;
  if (input.interests.includes("nature") && tags.includes("nature")) s += 1;
  if (input.interests.includes("food") && tags.includes("food")) s += 0.8;
  if (p.opening_hours == null) s -= 0.5; // ưu tiên điểm có giờ mở cửa rõ ràng
  const price = priceEstimate(p);
  if (input.budget_level === "saving" && price != null && price > 150_000) s -= 0.7;
  return s;
}

/** Sắp theo láng giềng gần nhất bắt đầu từ `from`. */
function nearestChain(places: Place[], from: LatLng): Place[] {
  const rest = [...places];
  const out: Place[] = [];
  let pos = from;
  while (rest.length) {
    let bi = 0;
    for (let i = 1; i < rest.length; i++) {
      if (haversineKm(pos, rest[i].location) < haversineKm(pos, rest[bi].location)) bi = i;
    }
    const [next] = rest.splice(bi, 1);
    out.push(next);
    pos = next.location;
  }
  return out;
}

type Ctx = {
  input: TripInput;
  planType: PlanType;
  foods: Place[];
  cafes: Place[];
  evenings: Place[];
  used: Set<string>;
  issues: ConstraintIssue[];
};

/** a0, b0, a1, b1, … rồi phần còn lại. */
function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

/** Sở thích nào liên quan tới chủ đề phương án (để lý do không gượng ép – AC-F8.4-05). */
const RELATED_INTERESTS: Record<PlanType, Interest[]> = {
  heritage: ["heritage", "photo"],
  balanced: ["heritage", "photo", "nature", "nightlife"],
  food_relax: ["food", "nightlife"],
};

function scheduleDay(ctx: Ctx, dayNo: number, date: string, sights: Place[], forcedEvening: Place | null): PlanDay {
  const { input, planType } = ctx;
  const cfg = CONFIG[planType];
  const weekday = weekdayOf(date);
  const slow = input.travel_with === "family_kids" || input.travel_with === "seniors";
  const items: PlannedItem[] = [];
  const usedToday = new Set<string>();
  let t = DAY_START;
  let pos: LatLng = HUE_CENTER;

  const push = (p: Place, kind: PlannedItemKind, start: number, dur: number, travel: number) => {
    items.push({
      place_id: p.id,
      kind,
      day_no: dayNo,
      start_min: start,
      duration_min: dur,
      travel_min: travel,
      est_cost_vnd: priceEstimate(p),
    });
    ctx.used.add(p.id);
    usedToday.add(p.id);
    t = start + dur;
    pos = p.location;
  };

  const visitDuration = (p: Place) => Math.round(((p.visit_duration_min ?? 60) * (slow ? 1.2 : 1)) / 5) * 5;

  const addVisit = (p: Place, kind: PlannedItemKind = "visit") => {
    const travel = estimateTravel(pos, p.location).minutes;
    const start = ceil5(alignToOpen(p, weekday, t + travel));
    push(p, kind, start, visitDuration(p), travel);
  };

  /** Chọn quán tốt nhất cho bữa/cà phê: đang mở, hợp ngân sách và chế độ ăn, gần vị trí hiện tại. */
  const addFood = (pool: Place[], kind: "meal" | "cafe", windowStart: number, label: string) => {
    const dur = MEAL_DURATION[kind];
    let best: { p: Place; start: number; travel: number; score: number } | null = null;
    for (const p of pool) {
      if (usedToday.has(p.id) || (kind === "cafe" && ctx.used.has(p.id))) continue;
      if (input.dietary.includes("vegetarian") && p.vegetarian_friendly !== true) continue;
      if (p.price_min_vnd != null && p.price_min_vnd > MEAL_CAP[input.budget_level]) continue;
      const travel = estimateTravel(pos, p.location).minutes;
      const start = ceil5(Math.max(t + travel, windowStart));
      const open = fitsOpen(p, weekday, start, dur);
      if (open === "no") continue;
      let score = -haversineKm(pos, p.location);
      if (ctx.used.has(p.id)) score -= 4;
      if (open === "unknown") score -= 1.5;
      if (planType === "food_relax" && p.highlight_tags.includes("local_food")) score += 1.5;
      if (input.budget_level === "comfortable" && p.highlight_tags.includes("royal_cuisine")) score += 1;
      // BR-MAP-05: nội dung tài trợ không được cộng điểm.
      if (!best || score > best.score) best = { p, start, travel, score };
    }
    if (best) push(best.p, kind, best.start, dur, best.travel);
    else if (kind === "meal") {
      ctx.issues.push({
        code: "NO_MEAL",
        severity: "warning",
        day_no: dayNo,
        message: `Chưa tìm được quán phù hợp cho ${label} ngày ${dayNo} (theo ngân sách và chế độ ăn).`,
      });
    }
  };

  let lunchDone = false;
  for (const s of sights) {
    const travel = estimateTravel(pos, s.location).minutes;
    const wouldEnd = alignToOpen(s, weekday, t + travel) + visitDuration(s);
    if (!lunchDone && (t >= LUNCH_FROM || (t >= 10 * 60 + 30 && wouldEnd > LUNCH_LATEST + 30))) {
      addFood(ctx.foods, "meal", LUNCH_FROM, "bữa trưa");
      lunchDone = true;
    }
    addVisit(s);
  }
  if (!lunchDone) addFood(ctx.foods, "meal", LUNCH_FROM, "bữa trưa");

  if (cfg.cafe && t < 17 * 60) addFood(ctx.cafes, "cafe", CAFE_FROM, "cà phê");

  addFood(ctx.foods, "meal", DINNER_FROM, "bữa tối");

  const wantsEvening = cfg.evening || input.interests.includes("nightlife");
  if (forcedEvening) {
    addVisit(forcedEvening, "evening");
  } else if (wantsEvening) {
    const candidates = ctx.evenings
      .filter((p) => !ctx.used.has(p.id))
      .map((p) => {
        const travel = estimateTravel(pos, p.location).minutes;
        return { p, ok: fitsOpen(p, weekday, ceil5(t + travel), visitDuration(p)) === "yes" };
      })
      .filter((c) => c.ok);
    if (candidates.length) addVisit(candidates[0].p, "evening");
  }

  return { day_no: dayNo, date, items };
}

function buildReasons(planType: PlanType, input: TripInput, days: PlanDay[], byId: Map<string, Place>): MatchReason[] {
  const reasons: MatchReason[] = [];
  const all = days.flatMap((d) => d.items).map((i) => byId.get(i.place_id)!);
  const sights = all.filter(isSight);
  const heritage = sights.filter((p) => p.layer === "heritage");
  const names = (ps: Place[]) => ps.slice(0, 2).map((p) => p.name).join(", ");
  const others = sights.length - heritage.length;

  let body: string;
  if (planType === "heritage") {
    body = `ưu tiên ${heritage.length} di tích, gồm ${names(heritage)}.`;
  } else if (planType === "balanced") {
    body =
      others > 0
        ? `xen kẽ ${heritage.length} di tích với ${others} điểm ngắm cảnh, dạo phố như ${names(sights.filter((p) => p.layer === "attraction"))}.`
        : `gồm ${heritage.length} di tích, có thời gian nghỉ giữa các điểm.`;
  } else {
    const local = all.filter((p) => p.layer === "food" && p.highlight_tags.includes("local_food"));
    body = `mỗi ngày ít điểm tham quan hơn, có món Huế ở ${names(local.length ? local : all.filter((p) => p.layer === "food"))}.`;
  }
  const related = input.interests.filter((i) => RELATED_INTERESTS[planType].includes(i));
  reasons.push({
    code: "PREFERENCE_MATCH",
    text: related.length
      ? `Bạn chọn ${related.map((i) => INTEREST_LABEL[i]).join(" + ")} → ${body}`
      : body.charAt(0).toUpperCase() + body.slice(1),
  });

  if (input.travel_with === "family_kids" || input.travel_with === "seniors") {
    reasons.push({
      code: "GROUP_FIT",
      text: `Đi cùng ${TRAVEL_WITH_LABEL[input.travel_with].toLowerCase()} → mỗi ngày bớt 1 điểm, thời gian tham quan dài hơn.`,
    });
  }
  if (input.dietary.includes("vegetarian")) {
    reasons.push({ code: "PREFERENCE_MATCH", text: "Bạn ăn chay → các bữa chọn quán chay hoặc có món chay." });
  } else if (input.budget_level === "saving") {
    reasons.push({
      code: "BUDGET_FIT",
      text: `Ngân sách ${BUDGET_LABEL.saving.toLowerCase()} → bữa ăn chọn quán dưới ${formatVnd(MEAL_CAP.saving)}/người.`,
    });
  }
  if (input.must_have_place_ids.length) {
    reasons.push({ code: "ROUTE_FIT", text: `Đã xếp ${input.must_have_place_ids.length} điểm bắt buộc bạn chọn vào lịch.` });
  }
  return reasons.slice(0, 3);
}

function generateOne(planType: PlanType, input: TripInput, places: Place[], byId: Map<string, Place>): GeneratedPlan {
  const cfg = CONFIG[planType];
  const slow = input.travel_with === "family_kids" || input.travel_with === "seniors";
  const perDay = Math.max(1, BASE_SIGHTS[input.pace] + cfg.sightDelta - (slow ? 1 : 0));
  const must = new Set(input.must_have_place_ids);

  const daytimePool = places.filter((p) => isSight(p) && (!isEveningSpot(p) || must.has(p.id)));
  const eveningMust = places.filter((p) => must.has(p.id) && isEveningSpot(p));
  const mustDay = daytimePool.filter((p) => must.has(p.id) && !isEveningSpot(p));

  const ranked = daytimePool
    .filter((p) => !must.has(p.id))
    .sort((a, b) => sightScore(b, cfg, input) - sightScore(a, cfg, input));
  // Tỷ lệ theo chủ đề để 3 phương án khác nhau rõ (AC-F1-02).
  const ofLayer = (l: Place["layer"]) => ranked.filter((p) => p.layer === l);
  const ordered =
    planType === "balanced"
      ? interleave(ofLayer("heritage"), ofLayer("attraction"))
      : planType === "food_relax"
        ? interleave(ofLayer("attraction"), ofLayer("heritage"))
        : ranked;
  const capacity = Math.max(perDay * input.day_count, mustDay.length);
  const chosen = nearestChain([...mustDay, ...ordered].slice(0, capacity), HUE_CENTER);

  // Chia đều theo thứ tự tuyến để mỗi ngày đi một khu vực.
  const dayChunks: Place[][] = [];
  let k = 0;
  for (let d = 0; d < input.day_count; d++) {
    const size = Math.floor(chosen.length / input.day_count) + (d < chosen.length % input.day_count ? 1 : 0);
    dayChunks.push(nearestChain(chosen.slice(k, k + size), HUE_CENTER));
    k += size;
  }

  const ctx: Ctx = {
    input,
    planType,
    foods: places.filter((p) => p.layer === "food" && p.primary_category_id !== "cat-cafe"),
    cafes: places.filter((p) => p.layer === "food" && p.primary_category_id === "cat-cafe"),
    evenings: places.filter(isEveningSpot),
    used: new Set(),
    issues: [],
  };

  const days = dayChunks.map((sights, d) =>
    scheduleDay(ctx, d + 1, addDays(input.start_date, d), sights, eveningMust[d] ?? null),
  );

  return {
    plan_type: planType,
    title: PLAN_TITLE[planType],
    reasons: buildReasons(planType, input, days, byId),
    rule_version: RULE_VERSION,
    ...evaluateDays(days, input, byId, ctx.issues),
  };
}

/**
 * Tính lại chi phí, kiểm tra ràng buộc và trạng thái khả thi cho một bộ ngày.
 * Dùng khi sinh phương án và mỗi lần người dùng sửa lịch (thêm/xóa điểm – UX-05, UX-06).
 */
export function evaluateDays(
  days: PlanDay[],
  input: TripInput,
  byId: Map<string, Place>,
  extraIssues: ConstraintIssue[] = [],
): Pick<GeneratedPlan, "days" | "summary" | "est_cost_per_person_vnd" | "unknown_price_count" | "issues" | "feasible"> {
  let total = 0;
  let unknown = 0;
  const issues: ConstraintIssue[] = [...checkPlan(days, byId, input.must_have_place_ids), ...extraIssues];

  for (const day of days) {
    let dayCost = 0;
    for (const it of day.items) {
      if (it.est_cost_vnd == null) unknown++;
      else dayCost += it.est_cost_vnd;
    }
    total += dayCost;
    if (dayCost > DAILY_CAP[input.budget_level]) {
      issues.push({
        code: "OVER_BUDGET",
        severity: "warning",
        day_no: day.day_no,
        message: `Ngày ${day.day_no} ước tính ${formatVnd(dayCost)}/người, cao hơn mức ${BUDGET_LABEL[input.budget_level].toLowerCase()}.`,
      });
    }
    // UC-04 4a: quá nhiều điểm trong một ngày
    const visits = day.items.filter((i) => i.kind === "visit").length;
    if (visits > MAX_SIGHTS_PER_DAY) {
      issues.push({
        code: "DAY_OVERLOAD",
        severity: "error",
        day_no: day.day_no,
        message: `Ngày ${day.day_no} có ${visits} điểm tham quan, nên tối đa ${MAX_SIGHTS_PER_DAY}. Thử tăng số ngày hoặc bớt điểm bắt buộc.`,
      });
    }
  }

  const stops = days.reduce((n, d) => n + d.items.length, 0);
  return {
    days,
    summary: `${days.length} ngày · ${stops} điểm dừng`,
    est_cost_per_person_vnd: total,
    unknown_price_count: unknown,
    issues,
    feasible: isFeasible(issues),
  };
}

/** AC-F1-02: tối đa 3 phương án phân biệt rõ. Chỉ dùng địa điểm đã xuất bản. */
export function generatePlans(input: TripInput, places: Place[]): GeneratedPlan[] {
  const published = places.filter((p) => p.publish_status === "published");
  const byId = new Map(published.map((p) => [p.id, p]));
  return PLAN_ORDER.map((t) => generateOne(t, input, published, byId));
}
