"use client";

// Đồng bộ chuyến đi giữa bản nháp trên trình duyệt và Supabase (khi đã đăng nhập).
// - Lưu: RPC save_trip_version → mỗi lần lưu là một phiên bản mới, có khóa lạc quan (BR-VERSION-01).
// - Nạp: chuyến đi cập nhật gần nhất + phiên bản hiện hành → bản nháp (mở trên máy khác vẫn thấy lịch).
// - Sở thích chỉ lưu lên server khi người dùng đã đồng ý mục "personalization" (PR-01, BR-PREF-02).
// Tính khả thi luôn được tính lại bằng Constraint Engine, không lưu kết quả cũ (BR-FEAS-01).

import { PLAN_TITLE } from "@/lib/labels";
import { addDays, fmtMin } from "@/lib/places";
import { evaluateDays } from "@/lib/reco/generate-plans";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { readTripDraft, replaceTripDraft, setServerInfo, updateSelectedPlan, type TripDraft } from "@/lib/trip-draft";
import type {
  BudgetLevel,
  GeneratedPlan,
  Interest,
  MatchReason,
  Pace,
  Place,
  PlanDay,
  PlannedItemKind,
  PlanType,
  TravelWith,
  TripInput,
} from "@/lib/types";

/** Lịch đã được sửa ở thiết bị khác sau lần tải cuối (HTTP 409). */
export class TripConflictError extends Error {
  constructor(public currentVersion: number | null) {
    super("VERSION_CONFLICT");
  }
}

export async function saveDraftToServer(draft: TripDraft, userId: string) {
  const plan = draft.selected;
  if (!plan) return;
  const supabase = getSupabaseBrowserClient();
  const mine = draft.server?.user_id === userId ? draft.server : undefined;
  const { input } = draft;

  const { data, error } = await supabase.rpc("save_trip_version", {
    p_trip_id: mine?.trip_id ?? null,
    p_expected_version: mine?.version_no ?? null,
    p_trip: {
      start_date: input.start_date,
      day_count: input.day_count,
      travel_with: input.travel_with,
      party_size: input.party_size,
      budget_level: input.budget_level,
      pace: input.pace,
      stay_place_id: input.stay_place_id ?? null,
    },
    p_plan_type: plan.plan_type,
    p_rule_version: plan.rule_version,
    p_reasons: plan.reasons,
    p_items: plan.days.flatMap((d) =>
      d.items.map((i) => ({
        place_id: i.place_id,
        kind: i.kind,
        day_no: i.day_no,
        start_time: fmtMin(i.start_min),
        duration_min: i.duration_min,
        travel_min: i.travel_min,
        est_cost_vnd: i.est_cost_vnd,
      })),
    ),
  });

  if (error) {
    if (error.code === "PT409") {
      let current: number | null = null;
      try {
        current = JSON.parse(error.details ?? "{}").current_version ?? null;
      } catch {
        // bỏ qua
      }
      throw new TripConflictError(current);
    }
    throw new Error(error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as { trip_id: string; version_no: number };
  setServerInfo({ trip_id: row.trip_id, version_no: row.version_no, user_id: userId });
  await savePreferences(input, userId);
}

async function savePreferences(input: TripInput, userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data: consent } = await supabase
    .from("consents")
    .select("id")
    .eq("purpose", "personalization")
    .eq("status", "granted")
    .limit(1);
  if (!consent?.length) return;
  await supabase.from("user_preferences").upsert({
    user_id: userId,
    interests: input.interests,
    must_haves: input.must_have_place_ids.length ? { place_ids: input.must_have_place_ids } : null,
    dietary: input.dietary,
    travel_with: input.travel_with,
    updated_at: new Date().toISOString(),
  });
}

type ItemRow = {
  place_id: string | null;
  kind: PlannedItemKind;
  day_no: number;
  start_time: string;
  duration_min: number;
  travel_min: number | null;
  est_cost_vnd: number | null;
};
type VersionRow = {
  version_no: number;
  plan_type: PlanType;
  rule_version: string | null;
  reasons: MatchReason[];
  itinerary_items: ItemRow[];
};
type TripRow = {
  id: string;
  start_date: string;
  day_count: number;
  travel_with: TravelWith;
  party_size: number;
  budget_level: BudgetLevel;
  pace: Pace;
  stay_place_id: string | null;
  trip_versions: VersionRow[];
};

/** Chuyến đi cập nhật gần nhất của người dùng, dạng bản nháp; null nếu chưa có. */
export async function loadLatestTrip(userId: string, places: Place[]): Promise<TripDraft | null> {
  const supabase = getSupabaseBrowserClient();
  const query = (withStay: boolean) =>
    supabase
      .from("trips")
      .select(
        `id, start_date, day_count, travel_with, party_size, budget_level, pace, ${withStay ? "stay_place_id, " : ""}` +
          "trip_versions!inner(version_no, plan_type, rule_version, reasons, " +
          "itinerary_items(place_id, kind, day_no, start_time, duration_min, travel_min, est_cost_vnd))",
      )
      .eq("trip_versions.is_current", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<TripRow>();
  let { data: trip, error } = await query(true);
  // Chưa chạy migration 20261024000001_trip_stay.sql → đọc lại không có cột nơi ở.
  if (error && error.message.includes("stay_place_id")) ({ data: trip, error } = await query(false));
  if (error) throw new Error(error.message);
  if (!trip || !trip.trip_versions[0]) return null;

  const { data: pref } = await supabase
    .from("user_preferences")
    .select("interests, must_haves, dietary")
    .eq("user_id", userId)
    .maybeSingle<{ interests: Interest[]; must_haves: { place_ids?: string[] } | null; dietary: "vegetarian"[] }>();

  const input: TripInput = {
    interests: pref?.interests ?? [],
    start_date: trip.start_date,
    day_count: trip.day_count,
    travel_with: trip.travel_with,
    party_size: trip.party_size,
    budget_level: trip.budget_level,
    pace: trip.pace,
    must_have_place_ids: pref?.must_haves?.place_ids ?? [],
    dietary: pref?.dietary ?? [],
    stay_place_id: trip.stay_place_id ?? null,
  };

  const version = trip.trip_versions[0];
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const days: PlanDay[] = Array.from({ length: trip.day_count }, (_, d) => ({
    day_no: d + 1,
    date: addDays(trip.start_date, d),
    items: version.itinerary_items
      .filter((i) => i.day_no === d + 1 && i.place_id)
      .map((i) => ({
        place_id: i.place_id!,
        kind: i.kind,
        day_no: i.day_no,
        start_min: toMin(i.start_time),
        duration_min: i.duration_min,
        travel_min: i.travel_min ?? 0,
        est_cost_vnd: i.est_cost_vnd,
      }))
      .sort((a, b) => a.start_min - b.start_min),
  }));

  const byId = new Map(places.map((p) => [p.id, p]));
  const plan: GeneratedPlan = {
    plan_type: version.plan_type,
    title: PLAN_TITLE[version.plan_type],
    reasons: version.reasons ?? [],
    rule_version: version.rule_version ?? "unknown",
    ...evaluateDays(days, input, byId),
  };

  return {
    input,
    selected: plan,
    updated_at: new Date().toISOString(),
    server: { trip_id: trip.id, version_no: version.version_no, user_id: userId },
  };
}

/**
 * Ghi lịch đã sửa: cập nhật ngay trên máy (AC-F8.3-04), rồi lưu phiên bản mới lên server nếu đã đăng nhập.
 * Ném TripConflictError khi lịch đã bị sửa ở thiết bị khác.
 */
export async function commitPlan(plan: GeneratedPlan, userId: string | null) {
  updateSelectedPlan(plan);
  const draft = readTripDraft();
  if (userId && draft) await saveDraftToServer(draft, userId);
}

/** Ghi đồng thời đầu vào + lịch (ví dụ đổi nơi ở ở UX-07), rồi lưu phiên bản mới nếu đã đăng nhập. */
export async function commitDraft(input: TripInput, plan: GeneratedPlan, userId: string | null) {
  const prev = readTripDraft();
  if (!prev) return;
  replaceTripDraft({ ...prev, input, selected: plan, updated_at: new Date().toISOString() });
  const draft = readTripDraft();
  if (userId && draft) await saveDraftToServer(draft, userId);
}
