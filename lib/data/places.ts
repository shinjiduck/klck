// Nguồn dữ liệu địa điểm cho các trang phía du khách.
// - Đã cấu hình Supabase: đọc view place_rows (RLS chỉ trả điểm đã xuất bản cho khách/du khách).
// - Chưa cấu hình: dùng dữ liệu giả lib/mock/places.ts như trước.
// Dữ liệu công khai, ít đổi → cache 'minutes' + tag 'places' (trang Admin gọi revalidateTag('places', 'max')
// sau khi sửa để bản đồ cập nhật).

import { cacheLife, cacheTag } from "next/cache";
import { MOCK_CATEGORIES, getPublishedPlaces as getMockPlaces } from "@/lib/mock/places";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";
import type { Category, Place } from "@/lib/types";

/** Một dòng của view public.place_rows. */
type PlaceRow = Omit<Place, "id" | "location"> & { id: string; slug: string; lat: number; lng: number };

function toPlace(r: PlaceRow): Place {
  return {
    id: r.id,
    name: r.name,
    location: { lat: r.lat, lng: r.lng },
    primary_category_id: r.primary_category_id,
    opening_hours: r.opening_hours,
    visit_duration_min: r.visit_duration_min,
    price_min_vnd: r.price_min_vnd,
    price_max_vnd: r.price_max_vnd,
    price_status: r.price_status,
    indoor: r.indoor,
    source: r.source,
    updated_at: r.updated_at,
    confidence: r.confidence,
    is_sponsored: r.is_sponsored,
    publish_status: r.publish_status,
    layer: r.layer,
    lodging_type: r.lodging_type,
    vegetarian_friendly: r.vegetarian_friendly,
    address: r.address,
    ward: r.ward,
    description: r.description,
    highlight_tags: r.highlight_tags ?? [],
    image_url: r.image_url,
  };
}

export async function getPublishedPlaces(): Promise<Place[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("places");

  if (!isSupabaseConfigured) return getMockPlaces();

  const { data, error } = await createPublicClient()
    .from("place_rows")
    .select("*")
    .eq("publish_status", "published")
    .order("name");
  // Không lặng lẽ quay về dữ liệu giả khi Supabase lỗi: hiển thị dữ liệu giả như thật là sai (BR-SOURCE-01).
  if (error) throw new Error(`Không đọc được địa điểm từ Supabase: ${error.message}`);
  return (data as PlaceRow[]).map(toPlace);
}

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("places");

  if (!isSupabaseConfigured) return MOCK_CATEGORIES;

  const { data, error } = await createPublicClient().from("categories").select("id, name, layer");
  if (error) throw new Error(`Không đọc được danh mục từ Supabase: ${error.message}`);
  return data as Category[];
}
