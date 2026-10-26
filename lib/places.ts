// Hàm thuần cho Hue Map (UX-02) và Thẻ địa điểm (UX-03).
// Liên quan: FR-F8-01 → 09, AC-F8.1-02, AC-F8.2-01 → 06, AC-F8.3-06, BR-PRICE-01, BR-SOURCE-01.
// Không phụ thuộc React để sau này viết test (Vitest) và tái dùng ở Route Handler.

import type {
  Category,
  Interest,
  LatLng,
  LodgingType,
  Place,
  PlaceLayer,
  PlaceMatch,
  UserPreference,
  Weekday,
} from "@/lib/types";
import { INTEREST_LABEL } from "@/lib/labels";

export const TIME_ZONE = "Asia/Ho_Chi_Minh";

/** Trung tâm Huế (gần cầu Trường Tiền) và khung nhìn mặc định. */
export const HUE_CENTER: LatLng = { lat: 16.4637, lng: 107.5809 };
export const HUE_DEFAULT_ZOOM = 12.2;

// ---------- Lớp ----------

export const LAYERS: PlaceLayer[] = ["heritage", "attraction", "food", "stay"];

export const LAYER_LABEL: Record<PlaceLayer, string> = {
  heritage: "Di tích",
  attraction: "Điểm du lịch",
  food: "Ăn uống",
  stay: "Lưu trú",
};

export const LODGING_LABEL: Record<LodgingType, string> = {
  hotel: "Khách sạn",
  homestay: "Homestay",
};

// ---------- Bộ lọc (FR-F8-05) ----------

export type FoodPriceTier = "lt50" | "50to150" | "gt150";
export type StayPriceTier = "lt500" | "500to1000" | "gt1000";

export const FOOD_PRICE_TIERS: { id: FoodPriceTier; label: string; min: number; max: number }[] = [
  { id: "lt50", label: "Dưới 50.000đ", min: 0, max: 49_999 },
  { id: "50to150", label: "50.000đ–150.000đ", min: 50_000, max: 150_000 },
  { id: "gt150", label: "Trên 150.000đ", min: 150_001, max: Infinity },
];

export const STAY_PRICE_TIERS: { id: StayPriceTier; label: string; min: number; max: number }[] = [
  { id: "lt500", label: "Dưới 500.000đ", min: 0, max: 499_999 },
  { id: "500to1000", label: "500.000đ–1.000.000đ", min: 500_000, max: 1_000_000 },
  { id: "gt1000", label: "Trên 1.000.000đ", min: 1_000_001, max: Infinity },
];

export type MapFilters = {
  q: string;
  layers: PlaceLayer[];
  /** Áp dụng cho mọi lớp. */
  openNow: boolean;
  /** Lớp Ăn uống: mức giá/người (theo giá thấp nhất). */
  foodPrice: FoodPriceTier[];
  /** Lớp Ăn uống: có món chay. */
  vegetarian: boolean;
  /** Lớp Lưu trú: loại hình. */
  lodging: LodgingType[];
  /** Lớp Lưu trú: giá/đêm (theo giá thấp nhất). */
  stayPrice: StayPriceTier[];
};

export const DEFAULT_FILTERS: MapFilters = {
  q: "",
  layers: [...LAYERS],
  openNow: false,
  foodPrice: [],
  vegetarian: false,
  lodging: [],
  stayPrice: [],
};

/** Số bộ lọc đang bật (không tính ô tìm kiếm và chip lớp), chỉ tính bộ lọc của lớp đang bật. */
export function countActiveFilters(f: MapFilters): number {
  let n = f.openNow ? 1 : 0;
  if (f.layers.includes("food")) n += f.foodPrice.length + (f.vegetarian ? 1 : 0);
  if (f.layers.includes("stay")) n += f.lodging.length + f.stayPrice.length;
  return n;
}

export function isDefaultFilters(f: MapFilters): boolean {
  return (
    f.q.trim() === "" &&
    f.layers.length === LAYERS.length &&
    !f.openNow &&
    f.foodPrice.length === 0 &&
    !f.vegetarian &&
    f.lodging.length === 0 &&
    f.stayPrice.length === 0
  );
}

// ---------- Lưu bộ lọc trên URL (FR-F8-06, AC-F8.2-01) ----------

function pickList<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
  if (!raw) return [];
  const set = new Set(raw.split(","));
  return allowed.filter((v) => set.has(v));
}

export function filtersFromSearchParams(sp: URLSearchParams): MapFilters {
  const layers = pickList(sp.get("layers"), LAYERS);
  return {
    q: sp.get("q") ?? "",
    layers: layers.length > 0 ? layers : [...LAYERS],
    openNow: sp.get("open") === "1",
    foodPrice: pickList(sp.get("fp"), FOOD_PRICE_TIERS.map((t) => t.id)),
    vegetarian: sp.get("veg") === "1",
    lodging: pickList(sp.get("lt"), ["hotel", "homestay"] as const),
    stayPrice: pickList(sp.get("sp"), STAY_PRICE_TIERS.map((t) => t.id)),
  };
}

/** Chỉ ghi giá trị khác mặc định để URL ngắn. */
export function filtersToSearchParams(f: MapFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.q.trim()) sp.set("q", f.q.trim());
  if (f.layers.length !== LAYERS.length) sp.set("layers", f.layers.join(","));
  if (f.openNow) sp.set("open", "1");
  if (f.foodPrice.length) sp.set("fp", f.foodPrice.join(","));
  if (f.vegetarian) sp.set("veg", "1");
  if (f.lodging.length) sp.set("lt", f.lodging.join(","));
  if (f.stayPrice.length) sp.set("sp", f.stayPrice.join(","));
  return sp;
}

// ---------- Giờ mở cửa ----------

const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** Thứ và số phút trong ngày theo giờ Việt Nam. */
export function nowInHue(date = new Date()): { weekday: Weekday; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = get("weekday").toLowerCase().slice(0, 3) as Weekday;
  return { weekday, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

function keyCoversDay(key: string, day: Weekday): boolean {
  const [from, to] = key.split("-") as [Weekday, Weekday | undefined];
  if (!to) return from === day;
  const i = WEEKDAYS.indexOf(from);
  const j = WEEKDAYS.indexOf(to);
  const d = WEEKDAYS.indexOf(day);
  if (i < 0 || j < 0) return false;
  return i <= j ? d >= i && d <= j : d >= i || d <= j;
}

/** Chuỗi giờ của một ngày, ví dụ "07:00-17:30" hoặc "closed". Khóa một ngày ưu tiên hơn khóa dải. */
function hoursForDay(place: Place, day: Weekday): string | null {
  const oh = place.opening_hours;
  if (!oh) return null;
  if (oh[day]) return oh[day] ?? null;
  for (const [key, value] of Object.entries(oh)) {
    if (key.includes("-") && keyCoversDay(key, day) && value) return value;
  }
  return null;
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

function parseRanges(value: string): [number, number][] {
  if (value.trim() === "closed") return [];
  return value.split(",").map((r) => {
    const [a, b] = r.trim().split("-");
    return [toMin(a), toMin(b)];
  });
}

/**
 * Các khung mở cửa (phút trong ngày) của một thứ: null = không có dữ liệu, [] = nghỉ.
 * Khung qua nửa đêm được cắt ở 24:00 (giới hạn GĐ1).
 */
export function getOpenRanges(place: Place, day: Weekday): [number, number][] | null {
  const raw = hoursForDay(place, day);
  if (raw == null) return null;
  return parseRanges(raw).map(([s, e]) => [s, e > s ? e : 24 * 60]);
}

/** "2026-10-24" → "sat" (theo lịch, không phụ thuộc múi giờ máy). */
export function weekdayOf(isoDate: string): Weekday {
  const [y, m, d] = isoDate.split("-").map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = CN
  return WEEKDAYS[(js + 6) % 7];
}

/** Cộng ngày cho chuỗi "YYYY-MM-DD". */
export function addDays(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Hôm nay theo giờ Việt Nam, dạng "YYYY-MM-DD". */
export function todayInHue(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);
}

export type OpenState = "open" | "closed" | "unknown";

export type OpenStatus = {
  state: OpenState;
  /** Giờ hôm nay để hiển thị, ví dụ "07:00–17:30"; null nếu không có dữ liệu. */
  todayText: string | null;
  /** Câu ngắn cho danh sách/thẻ. */
  label: string;
};

/**
 * Trạng thái mở cửa hiện tại (theo giờ Việt Nam).
 * Giới hạn GĐ1: khung qua nửa đêm chỉ tính phần thuộc ngày hôm nay.
 */
export function getOpenStatus(place: Place, date = new Date()): OpenStatus {
  const { weekday, minutes } = nowInHue(date);
  const raw = hoursForDay(place, weekday);
  if (raw == null) return { state: "unknown", todayText: null, label: "Giờ mở cửa: Không xác định" };

  const ranges = parseRanges(raw);
  if (ranges.length === 0) return { state: "closed", todayText: "Nghỉ", label: "Hôm nay nghỉ" };

  if (ranges.length === 1 && ranges[0][0] === 0 && ranges[0][1] >= 24 * 60) {
    return { state: "open", todayText: "00:00–24:00", label: "Mở cả ngày" };
  }

  const todayText = raw
    .split(",")
    .map((r) => r.trim().replace("-", "–"))
    .join(", ");

  for (const [start, end] of ranges) {
    const open = end > start ? minutes >= start && minutes < end : minutes >= start || minutes < end;
    if (open) return { state: "open", todayText, label: `Đang mở cửa · Đóng lúc ${fmtMin(end)}` };
  }
  const next = ranges.find(([start]) => start > minutes);
  return {
    state: "closed",
    todayText,
    label: next ? `Đã đóng cửa · Mở lúc ${fmtMin(next[0])}` : "Đã đóng cửa",
  };
}

/** Phút trong ngày → "HH:MM" (24h). */
export function fmtMin(m: number): string {
  const h = Math.floor(m / 60) % 24;
  return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// ---------- Giá (BR-PRICE-01) ----------

const vnd = new Intl.NumberFormat("vi-VN");

/** 150000 → "150.000đ" */
export function formatVnd(n: number): string {
  return `${vnd.format(n)}đ`;
}

export const UNKNOWN = "Không xác định";

/** Ví dụ "Vé 150.000đ (ước tính)", "35.000đ–50.000đ/người (đã xác nhận)", "Không xác định". */
export function getPriceText(place: Place): string {
  const { price_min_vnd: min, price_max_vnd: max } = place;
  if (min == null && max == null) return UNKNOWN;

  let value: string;
  if ((min ?? 0) === 0 && (max ?? 0) === 0) value = "Miễn phí";
  else if (min != null && max != null && min !== max) value = `${formatVnd(min)}–${formatVnd(max)}`;
  else value = formatVnd((min ?? max) as number);

  const free = value === "Miễn phí";
  const prefix = !free && (place.layer === "heritage" || place.layer === "attraction") ? "Vé " : "";
  const unit = free ? "" : place.layer === "food" ? "/người" : place.layer === "stay" ? "/đêm" : "";
  const status =
    place.price_status === "estimated" ? " (ước tính)" : place.price_status === "confirmed" ? " (đã xác nhận)" : "";
  return `${prefix}${value}${unit}${status}`;
}

/** AC-F3-03: nhãn trạng thái giá trên thẻ gợi ý ăn, ở. */
export const PRICE_STATUS_LABEL: Record<Place["price_status"], string> = {
  estimated: "Giá tham khảo",
  confirmed: "Đối tác xác nhận",
  unknown: "Không xác định",
};

/** Giá trị số của giá, không kèm nhãn trạng thái. Ví dụ "35.000đ–50.000đ/người", "Không xác định". */
export function getPriceValue(place: Place): string {
  const { price_min_vnd: min, price_max_vnd: max } = place;
  if (min == null && max == null) return UNKNOWN;
  const unit = place.layer === "food" ? "/người" : place.layer === "stay" ? "/đêm" : "";
  if ((min ?? 0) === 0 && (max ?? 0) === 0) return "Miễn phí";
  if (min != null && max != null && min !== max) return `${formatVnd(min)}–${formatVnd(max)}${unit}`;
  return `${formatVnd((min ?? max) as number)}${unit}`;
}

// ---------- Nguồn, ngày cập nhật (BR-SOURCE-01) ----------

/** "2026-10-15T09:00:00+07:00" → "10/2026" */
export function formatUpdatedMonth(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, month: "2-digit", year: "numeric" }).formatToParts(
    new Date(iso),
  );
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("month")}/${get("year")}`;
}

// ---------- Khoảng cách, chỉ đường ----------

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Ước tính GĐ1 theo SRS: đường chim bay × 1,4 ÷ 20 km/h (xe máy nội thành) + 10 phút dự phòng.
 */
export function estimateTravel(from: LatLng, to: LatLng): { km: number; minutes: number } {
  const km = haversineKm(from, to) * 1.4;
  return { km, minutes: Math.round((km / 20) * 60 + 10) };
}

/** AC-F8.3-06: đường dẫn chỉ đường Google Maps, không cần API key. */
export function directionsUrl(p: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
}

// ---------- Lọc ----------

export type Bounds = { west: number; south: number; east: number; north: number };

export function inBounds(p: LatLng, b: Bounds): boolean {
  return p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east;
}

/** Bỏ dấu tiếng Việt để tìm "dai noi" vẫn ra "Đại Nội". */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}

function inTier(price: number | null, tiers: { min: number; max: number }[]): boolean {
  if (price == null) return false;
  return tiers.some((t) => price >= t.min && price <= t.max);
}

export function matchesFilters(
  place: Place,
  f: MapFilters,
  category: Category | undefined,
  now = new Date(),
): boolean {
  if (!f.layers.includes(place.layer)) return false;

  const q = normalizeText(f.q.trim());
  if (q) {
    const hay = normalizeText(`${place.name} ${category?.name ?? ""} ${place.address ?? ""}`);
    if (!hay.includes(q)) return false;
  }

  if (f.openNow && getOpenStatus(place, now).state !== "open") return false;

  if (place.layer === "food") {
    if (f.foodPrice.length && !inTier(place.price_min_vnd, FOOD_PRICE_TIERS.filter((t) => f.foodPrice.includes(t.id))))
      return false;
    if (f.vegetarian && place.vegetarian_friendly !== true) return false;
  }

  if (place.layer === "stay") {
    if (f.lodging.length && (!place.lodging_type || !f.lodging.includes(place.lodging_type))) return false;
    if (f.stayPrice.length && !inTier(place.price_min_vnd, STAY_PRICE_TIERS.filter((t) => f.stayPrice.includes(t.id))))
      return false;
  }

  return true;
}

// ---------- "Hợp với bạn" (F8.4) ----------

/**
 * Nhãn phù hợp cho thẻ. Trả null khi chưa có sở thích (AC-F8.4-03: không khẳng định "Hợp với bạn").
 * Bản GĐ1 chỉ dùng PREFERENCE_MATCH; chấm điểm đầy đủ làm ở bước lib/reco.
 */
export function getPlaceMatch(place: Place, pref: UserPreference | null): PlaceMatch | null {
  if (!pref || pref.interests.length === 0) return null;

  const hits: Interest[] = pref.interests.filter((i) => {
    if (i === "heritage") return place.layer === "heritage";
    if (i === "food") return place.layer === "food";
    if (i === "photo") return place.highlight_tags.includes("photo_spot");
    if (i === "nature") return place.highlight_tags.includes("nature");
    if (i === "nightlife") return place.highlight_tags.includes("nightlife");
    return false;
  });
  if (hits.length === 0) return null;

  // AC-F8.4-05: lý do nối với lựa chọn của người dùng.
  const chosen = hits.map((i) => INTEREST_LABEL[i]).join(" + ");
  const detail = place.description ?? LAYER_LABEL[place.layer];
  return {
    level: place.description ? "match" : "maybe",
    reasons: [{ code: "PREFERENCE_MATCH", text: `Bạn chọn ${chosen} → ${detail}` }],
  };
}
