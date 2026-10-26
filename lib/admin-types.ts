// Kiểu dữ liệu và kiểm tra hợp lệ dùng chung cho khu vực Admin (FR-ADM-01 → 06).
// Dùng ở cả trình duyệt (form, nhập CSV) và Route Handler (kiểm tra lại phía server).

import { z } from "zod";
import type { Place } from "@/lib/types";

export type AppRole = "traveler" | "partner" | "editor" | "admin";

export const ROLE_LABEL: Record<AppRole, string> = {
  traveler: "Du khách",
  partner: "Đối tác",
  editor: "Biên tập viên",
  admin: "Quản trị viên",
};

/** AC-SUP-04: quá hạn cập nhật sau 90 ngày → "Cần kiểm tra". */
export const STALE_DAYS = 90;

export function isStale(updatedAt: string, now = new Date()): boolean {
  return now.getTime() - new Date(updatedAt).getTime() > STALE_DAYS * 24 * 3600 * 1000;
}

/** Một dòng địa điểm như admin thấy (mọi trạng thái), kèm slug. */
export type AdminPlace = Place & { slug: string };

const HOURS_KEY = /^(mon|tue|wed|thu|fri|sat|sun)(-(mon|tue|wed|thu|fri|sat|sun))?$/;
const HOURS_VALUE = /^(closed|([01]\d|2[0-4]):[0-5]\d-([01]\d|2[0-4]):[0-5]\d(,([01]\d|2[0-4]):[0-5]\d-([01]\d|2[0-4]):[0-5]\d)*)$/;

export const openingHoursSchema = z
  .record(z.string().regex(HOURS_KEY, "Khóa ngày không hợp lệ (vd. mon-sun, sat)"), z.string().regex(HOURS_VALUE, "Giờ không hợp lệ (vd. 07:00-17:30 hoặc closed)"))
  .nullable();

/** Dữ liệu ghi một địa điểm. Kiểm tra xuất bản (nguồn + ngày cập nhật) tách riêng để vẫn lưu được nháp. */
export const placeInputSchema = z
  .object({
    name: z.string().trim().min(2, "Tên ít nhất 2 ký tự").max(120),
    layer: z.enum(["heritage", "attraction", "food", "stay"]),
    lodging_type: z.enum(["hotel", "homestay"]).nullable(),
    primary_category_id: z.string().min(1, "Chọn danh mục"),
    lat: z.number({ error: "Thiếu vĩ độ" }).min(16.2, "Ngoài khu vực Huế").max(16.7, "Ngoài khu vực Huế"),
    lng: z.number({ error: "Thiếu kinh độ" }).min(107.3, "Ngoài khu vực Huế").max(107.9, "Ngoài khu vực Huế"),
    opening_hours: openingHoursSchema,
    visit_duration_min: z.number().int().positive().max(600).nullable(),
    price_min_vnd: z.number().int().min(0).nullable(),
    price_max_vnd: z.number().int().min(0).nullable(),
    price_status: z.enum(["estimated", "confirmed", "unknown"]),
    indoor: z.boolean().nullable(),
    vegetarian_friendly: z.boolean().nullable(),
    is_sponsored: z.boolean(),
    address: z.string().trim().max(200).nullable(),
    ward: z.string().trim().max(100).nullable(),
    description: z.string().trim().max(1000).nullable(),
    highlight_tags: z.array(z.string().trim().min(1).max(40)).max(20),
    image_url: z.string().url("Link ảnh không hợp lệ").nullable(),
    source: z.string().trim().max(300),
    /** YYYY-MM-DD */
    updated_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ").or(z.literal("")),
    publish_status: z.enum(["draft", "pending", "published", "hidden"]),
  })
  .superRefine((v, ctx) => {
    if ((v.layer === "stay") !== (v.lodging_type != null)) {
      ctx.addIssue({ code: "custom", path: ["lodging_type"], message: "Lưu trú phải chọn loại hình; lớp khác thì để trống" });
    }
    if (v.price_min_vnd != null && v.price_max_vnd != null && v.price_min_vnd > v.price_max_vnd) {
      ctx.addIssue({ code: "custom", path: ["price_max_vnd"], message: "Giá cao nhất phải ≥ giá thấp nhất" });
    }
    // AC-ADM-01 / UC-14 4a: thiếu nguồn hoặc ngày cập nhật thì không được xuất bản, chỉ lưu nháp.
    if (v.publish_status === "published") {
      if (!v.source) ctx.addIssue({ code: "custom", path: ["source"], message: "Cần nguồn dữ liệu để xuất bản" });
      if (!v.updated_at) ctx.addIssue({ code: "custom", path: ["updated_at"], message: "Cần ngày cập nhật để xuất bản" });
    }
  });

export type PlaceInput = z.infer<typeof placeInputSchema>;

/** Đổi dữ liệu form sang cột của bảng places. */
export function toPlaceRow(v: PlaceInput) {
  return {
    name: v.name,
    layer: v.layer,
    lodging_type: v.lodging_type,
    primary_category_id: v.primary_category_id,
    location: `SRID=4326;POINT(${v.lng} ${v.lat})`,
    opening_hours: v.opening_hours,
    visit_duration_min: v.visit_duration_min,
    price_min_vnd: v.price_min_vnd,
    price_max_vnd: v.price_max_vnd,
    price_status: v.price_status,
    indoor: v.indoor,
    vegetarian_friendly: v.vegetarian_friendly,
    is_sponsored: v.is_sponsored,
    address: v.address,
    ward: v.ward,
    description: v.description,
    highlight_tags: v.highlight_tags,
    image_url: v.image_url,
    source: v.source,
    // Lưu nháp khi chưa có ngày: dùng hôm nay để thỏa ràng buộc NOT NULL; xuất bản thì bắt buộc nhập (ở trên).
    updated_at: v.updated_at ? `${v.updated_at}T00:00:00+07:00` : new Date().toISOString(),
    publish_status: v.publish_status,
  };
}

/** Tạo slug từ tên (bỏ dấu tiếng Việt) – dùng khi thêm mới/nhập CSV. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
