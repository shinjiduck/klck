// Nhãn tiếng Việt cho các enum trong từ điển dữ liệu (dùng chung giữa giao diện và bộ sinh lý do).

import type { BudgetLevel, Interest, Pace, PlanType, TravelWith, Weekday } from "@/lib/types";

export const INTEREST_LABEL: Record<Interest, string> = {
  heritage: "Di tích",
  food: "Ẩm thực",
  photo: "Chụp ảnh",
  nature: "Thiên nhiên",
  nightlife: "Về đêm",
};

export const TRAVEL_WITH_LABEL: Record<TravelWith, string> = {
  solo: "Một mình",
  couple: "Cặp đôi",
  friends: "Nhóm bạn",
  family_kids: "Gia đình có trẻ nhỏ",
  seniors: "Người lớn tuổi",
};

export const BUDGET_LABEL: Record<BudgetLevel, string> = {
  saving: "Tiết kiệm",
  moderate: "Vừa phải",
  comfortable: "Thoải mái",
};

export const PACE_LABEL: Record<Pace, string> = {
  relaxed: "Thong thả",
  normal: "Vừa phải",
  packed: "Dày đặc",
};

export const PLAN_TITLE: Record<PlanType, string> = {
  heritage: "Di sản trọn vẹn",
  balanced: "Cân bằng khám phá",
  food_relax: "Ăn uống & thư giãn",
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  mon: "T2",
  tue: "T3",
  wed: "T4",
  thu: "T5",
  fri: "T6",
  sat: "T7",
  sun: "CN",
};
