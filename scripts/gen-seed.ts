// Sinh supabase/seed.sql từ lib/mock/places.ts (một nguồn dữ liệu giả duy nhất).
// Chạy: npm run db:seed-sql
// ⚠️ Đây là DỮ LIỆU GIẢ LẬP. Khi có dữ liệu thật đã kiểm tra, nhập qua trang Admin hoặc CSV.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { MOCK_CATEGORIES, MOCK_PLACES } from "../lib/mock/places";

const q = (v: string | null | undefined) => (v == null ? "null" : `'${v.replace(/'/g, "''")}'`);
const n = (v: number | null | undefined) => (v == null ? "null" : String(v));
const b = (v: boolean | null | undefined) => (v == null ? "null" : v ? "true" : "false");
const arr = (v: string[]) => `array[${v.map(q).join(", ")}]::text[]`;
const json = (v: unknown) => (v == null ? "null" : `${q(JSON.stringify(v))}::jsonb`);

const lines: string[] = [
  "-- ⚠️ DỮ LIỆU GIẢ LẬP – sinh tự động từ lib/mock/places.ts bằng `npm run db:seed-sql`.",
  "-- Không sửa tay file này. Chạy sau migration: SQL Editor → dán → Run. Chạy lại nhiều lần được (upsert theo slug).",
  "",
  "insert into public.categories (id, name, layer) values",
  MOCK_CATEGORIES.map((c) => `  (${q(c.id)}, ${q(c.name)}, ${q(c.layer)})`).join(",\n"),
  "on conflict (id) do update set name = excluded.name, layer = excluded.layer;",
  "",
  "insert into public.places (slug, name, location, primary_category_id, opening_hours, visit_duration_min,",
  "  price_min_vnd, price_max_vnd, price_status, indoor, source, updated_at, confidence, is_sponsored,",
  "  publish_status, layer, lodging_type, vegetarian_friendly, address, ward, description, highlight_tags, image_url) values",
  MOCK_PLACES.map(
    (p) =>
      `  (${q(p.id)}, ${q(p.name)}, extensions.st_setsrid(extensions.st_makepoint(${p.location.lng}, ${p.location.lat}), 4326)::extensions.geography, ` +
      `${q(p.primary_category_id)}, ${json(p.opening_hours)}, ${n(p.visit_duration_min)}, ${n(p.price_min_vnd)}, ${n(p.price_max_vnd)}, ` +
      `${q(p.price_status)}, ${b(p.indoor)}, ${q(p.source)}, ${q(p.updated_at)}, ${q(p.confidence)}, ${b(p.is_sponsored)}, ` +
      `${q(p.publish_status)}, ${q(p.layer)}, ${q(p.lodging_type)}, ${b(p.vegetarian_friendly)}, ${q(p.address)}, ${q(p.ward)}, ` +
      `${q(p.description)}, ${arr(p.highlight_tags)}, ${q(p.image_url)})`,
  ).join(",\n"),
  "on conflict (slug) do update set",
  [
    "name", "location", "primary_category_id", "opening_hours", "visit_duration_min", "price_min_vnd", "price_max_vnd",
    "price_status", "indoor", "source", "updated_at", "confidence", "is_sponsored", "publish_status", "layer",
    "lodging_type", "vegetarian_friendly", "address", "ward", "description", "highlight_tags", "image_url",
  ]
    .map((c) => `  ${c} = excluded.${c}`)
    .join(",\n") + ";",
  "",
];

const out = join(__dirname, "..", "supabase", "seed.sql");
writeFileSync(out, lines.join("\n"), "utf8");
console.log(`Đã ghi ${MOCK_PLACES.length} địa điểm, ${MOCK_CATEGORIES.length} danh mục → ${out}`);
