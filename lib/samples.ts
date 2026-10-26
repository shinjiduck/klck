// UC-01 Xem lịch mẫu (FR-F1-01) và bộ sưu tập địa điểm cho tab "Khám phá".
// Lịch mẫu chỉ lưu ĐẦU VÀO (sở thích, số ngày, nhịp độ…); lịch cụ thể được sinh bằng chính bộ sinh phương án
// và Constraint Engine trên dữ liệu đã xuất bản, nên luôn khớp giờ mở cửa của ngày người dùng xem.

import type { Place, PlanType, TripInput } from "@/lib/types";

export type SampleTrip = {
  id: string;
  title: string;
  description: string;
  plan_type: PlanType;
  input: Omit<TripInput, "start_date">;
};

export const SAMPLE_TRIPS: SampleTrip[] = [
  {
    id: "di-san-1-ngay",
    title: "Huế 1 ngày: tinh hoa di sản",
    description: "Đại Nội, lăng tẩm và một bữa món Huế. Hợp với lần đầu đến Huế.",
    plan_type: "heritage",
    input: {
      interests: ["heritage", "photo"],
      day_count: 1,
      travel_with: "couple",
      party_size: 2,
      budget_level: "moderate",
      pace: "normal",
      must_have_place_ids: [],
      dietary: [],
    },
  },
  {
    id: "gia-dinh-2-ngay",
    title: "2 ngày cho gia đình có trẻ nhỏ",
    description: "Nhịp chậm, ít điểm mỗi ngày, xen kẽ di tích và chỗ dạo chơi.",
    plan_type: "balanced",
    input: {
      interests: ["heritage", "nature"],
      day_count: 2,
      travel_with: "family_kids",
      party_size: 4,
      budget_level: "moderate",
      pace: "relaxed",
      must_have_place_ids: [],
      dietary: [],
    },
  },
  {
    id: "an-chay-thong-tha",
    title: "Huế ăn chay, thong thả",
    description: "Các bữa đều ở quán chay hoặc có món chay, ngân sách tiết kiệm.",
    plan_type: "food_relax",
    input: {
      interests: ["food", "heritage"],
      day_count: 2,
      travel_with: "solo",
      party_size: 1,
      budget_level: "saving",
      pace: "relaxed",
      must_have_place_ids: [],
      dietary: ["vegetarian"],
    },
  },
  {
    id: "ve-dem-nhom-ban",
    title: "Huế về đêm cho nhóm bạn",
    description: "Ban ngày khám phá, tối dạo cầu Trường Tiền; phố đi bộ mở thứ Sáu đến Chủ nhật.",
    plan_type: "balanced",
    input: {
      interests: ["nightlife", "food", "photo"],
      day_count: 1,
      travel_with: "friends",
      party_size: 4,
      budget_level: "moderate",
      pace: "normal",
      must_have_place_ids: [],
      dietary: [],
    },
  },
];

export function getSample(id: string): SampleTrip | undefined {
  return SAMPLE_TRIPS.find((s) => s.id === id);
}

export type Collection = {
  id: string;
  title: string;
  description: string;
  match: (p: Place) => boolean;
};

/** Bộ sưu tập dựng từ dữ liệu có sẵn (lớp, danh mục, thẻ nổi bật) – không cần nhập tay thêm. */
export const COLLECTIONS: Collection[] = [
  {
    id: "lang-tam",
    title: "Lăng tẩm triều Nguyễn",
    description: "Các lăng vua nằm ở phía nam thành phố.",
    match: (p) => p.primary_category_id === "cat-tomb",
  },
  {
    id: "hoang-hon",
    title: "Ngắm hoàng hôn",
    description: "Điểm đẹp nhất vào cuối chiều.",
    match: (p) => p.highlight_tags.includes("sunset"),
  },
  {
    id: "mon-hue",
    title: "Món Huế phải thử",
    description: "Bún bò, cơm hến, bánh bèo nậm lọc…",
    match: (p) => p.layer === "food" && p.highlight_tags.includes("local_food"),
  },
  {
    id: "chup-anh",
    title: "Chụp ảnh đẹp",
    description: "Kiến trúc, sông Hương và góc máy quen thuộc.",
    match: (p) => p.highlight_tags.includes("photo_spot") && p.layer !== "stay",
  },
  {
    id: "troi-mua",
    title: "Khi trời mưa",
    description: "Điểm tham quan trong nhà.",
    match: (p) => (p.layer === "heritage" || p.layer === "attraction") && p.indoor === true,
  },
  {
    id: "ve-dem",
    title: "Huế về đêm",
    description: "Dạo phố, cà phê, cầu lên đèn.",
    match: (p) => p.highlight_tags.includes("nightlife"),
  },
];
