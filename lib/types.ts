// Kiểu dữ liệu dùng chung, bám theo "Từ điển dữ liệu chính" trong docs/SRS.md.
// GĐ1 chưa nối Supabase: tên trường giữ snake_case giống cột trong CSDL để sau này
// đổi nguồn dữ liệu không phải đổi tên. Kiểu geography(Point) được biểu diễn bằng LatLng.

export type LatLng = { lat: number; lng: number };

// ---------- PLACE ----------

/** Lớp hiển thị trên Hue Map (FR-F8-01). */
export type PlaceLayer = "heritage" | "attraction" | "food" | "stay";

/** Loại hình lưu trú, bắt buộc khi layer = "stay" (FR-F8-05). */
export type LodgingType = "hotel" | "homestay";

/** BR-PRICE-01 */
export type PriceStatus = "estimated" | "confirmed" | "unknown";

export type Confidence = "high" | "medium" | "low";

export type PublishStatus = "draft" | "pending" | "published" | "hidden";

/** Khóa ngày trong opening_hours. */
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/**
 * Giờ mở cửa theo thứ. Khóa là một thứ ("mon") hoặc một dải ("mon-sun", "mon-fri");
 * giá trị là một hay nhiều khung "HH:MM-HH:MM" cách nhau bởi dấu phẩy,
 * hoặc "closed". Khung qua nửa đêm viết "18:00-02:00".
 * Ví dụ theo SRS: {"mon-sun":"07:00-17:30"}
 */
export type OpeningHours = Partial<Record<string, string>>;

export type Category = {
  id: string;
  name: string;
  layer: PlaceLayer;
};

export type Place = {
  id: string;
  name: string;
  location: LatLng;
  primary_category_id: string;
  opening_hours: OpeningHours | null;
  visit_duration_min: number | null;
  price_min_vnd: number | null;
  price_max_vnd: number | null;
  price_status: PriceStatus;
  indoor: boolean | null;
  source: string;
  /** ISO 8601 */
  updated_at: string;
  confidence: Confidence | null;
  is_sponsored: boolean;
  publish_status: PublishStatus;
  layer: PlaceLayer;
  /** Chỉ có khi layer = "stay". */
  lodging_type: LodgingType | null;
  vegetarian_friendly: boolean | null;
  address: string | null;
  ward: string | null;
  description: string | null;
  highlight_tags: string[];
  /** Ảnh đại diện (GĐ1 có thể để trống, giao diện hiện ảnh giữ chỗ). */
  image_url: string | null;
};

// ---------- TRIP / TRIP_VERSION / ITINERARY_ITEM ----------

export type TripStatus =
  | "draft"
  | "proposed"
  | "confirmed"
  | "adjusting"
  | "in_progress"
  | "completed"
  | "cancelled";

export type Pace = "relaxed" | "normal" | "packed";

export type BudgetLevel = "saving" | "moderate" | "comfortable";

export type TravelWith = "solo" | "couple" | "friends" | "family_kids" | "seniors";

export type PlanType = "heritage" | "balanced" | "food_relax";

export type Trip = {
  id: string;
  owner_id: string;
  title: string;
  status: TripStatus;
  /** YYYY-MM-DD */
  start_date: string;
  day_count: number;
  travel_with: TravelWith;
  party_size: number;
  budget_level: BudgetLevel;
  budget_vnd: number | null;
  pace: Pace;
  created_at: string;
  updated_at: string;
};

export type TripVersion = {
  id: string;
  trip_id: string;
  version_no: number;
  plan_type: PlanType;
  is_current: boolean;
  created_at: string;
};

export type ItineraryItem = {
  id: string;
  trip_version_id: string;
  place_id: string | null;
  day_no: number;
  /** HH:MM, 24h */
  start_time: string;
  duration_min: number;
  /** Thời gian di chuyển từ mục trước (phút). */
  travel_min: number | null;
  /** BR-TRIP-01 */
  is_out_of_range: boolean;
  note: string | null;
};

// ---------- USER_PREFERENCE ----------

export type Interest = "heritage" | "food" | "photo" | "nature" | "nightlife";

export type UserPreference = {
  user_id: string | null;
  interests: Interest[];
  /** Yêu cầu bắt buộc, tách khỏi sở thích (BR-PREF-01). */
  must_haves: Record<string, unknown> | null;
  /** Chỉ lưu khi người dùng tự khai (BR-PREF-02). */
  dietary: string[];
  travel_with: TravelWith | null;
};

// ---------- Khai sở thích + sinh phương án (F1, UX-01, UX-04) ----------

/** Dữ liệu khai ở màn UX-01 (FR-F1-02). Gộp phần của TRIP và USER_PREFERENCE. */
export type TripInput = {
  interests: Interest[];
  /** YYYY-MM-DD */
  start_date: string;
  day_count: number;
  travel_with: TravelWith;
  party_size: number;
  budget_level: BudgetLevel;
  pace: Pace;
  /** Điểm bắt buộc (BR-PREF-01: tách khỏi sở thích). */
  must_have_place_ids: string[];
  /** Chỉ có khi người dùng tự khai (BR-PREF-02). */
  dietary: "vegetarian"[];
};

export type PlannedItemKind = "visit" | "meal" | "cafe" | "evening";

/** Một mục trong lịch (AC-F1-03). Tương ứng ITINERARY_ITEM khi lưu. */
export type PlannedItem = {
  place_id: string;
  kind: PlannedItemKind;
  day_no: number;
  /** Phút trong ngày */
  start_min: number;
  duration_min: number;
  /** Thời gian di chuyển từ mục trước (hoặc từ điểm xuất phát). */
  travel_min: number;
  /** Chi phí ước tính/người; null = chưa rõ giá. */
  est_cost_vnd: number | null;
};

export type PlanDay = {
  day_no: number;
  /** YYYY-MM-DD */
  date: string;
  items: PlannedItem[];
};

export type ConstraintCode =
  | "CLOSED"
  | "UNKNOWN_HOURS"
  | "OVERLAP"
  | "TRAVEL_TIME"
  | "DUPLICATE"
  | "MUST_HAVE_MISSING"
  | "DAY_OVERLOAD"
  | "OVER_BUDGET"
  | "NO_MEAL";

/** Kết quả của Constraint Engine. "error" chặn trạng thái Khả thi (AC-F1-04), "warning" chỉ lưu ý. */
export type ConstraintIssue = {
  code: ConstraintCode;
  severity: "error" | "warning";
  message: string;
  day_no?: number;
  place_id?: string;
};

export type GeneratedPlan = {
  plan_type: PlanType;
  title: string;
  summary: string;
  /** 1–3 lý do nối với lựa chọn của người dùng. */
  reasons: MatchReason[];
  days: PlanDay[];
  est_cost_per_person_vnd: number;
  /** Số mục chưa rõ giá (không cộng vào tổng). */
  unknown_price_count: number;
  issues: ConstraintIssue[];
  /** Khả thi khi không có issue mức "error" (BR-FEAS-01: do Constraint Engine quyết định, không do AI). */
  feasible: boolean;
  /** Để truy vết khi kết quả sai (RECOMMENDATION_LOG.rule_version). */
  rule_version: string;
};

// ---------- Gợi ý "Hợp với bạn" (F8.4) ----------

/** AC-F8.4-01 */
export type ReasonCode =
  | "PREFERENCE_MATCH"
  | "GROUP_FIT"
  | "ROUTE_FIT"
  | "BUDGET_FIT"
  | "WEATHER_FIT"
  | "OPEN_NOW";

export type MatchReason = { code: ReasonCode; text: string };

/** Kết quả hiển thị; không chứa điểm số thô (AC-F8.4-02). */
export type PlaceMatch = {
  level: "match" | "maybe";
  reasons: MatchReason[];
};
