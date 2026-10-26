// Đọc file CSV địa điểm theo mẫu trong SRS ("Dữ liệu mẫu") → PlaceInput. FR-ADM-04, AC-ADM-02.
// Cột bắt buộc theo SRS: name, layer, lat, lng, price_status, source, updated_at (+ lodging_type khi layer=stay).
// Cột thêm (tùy chọn): category, vegetarian_friendly, address, ward, is_sponsored, image_url, publish_status.

import { placeInputSchema, type PlaceInput } from "@/lib/admin-types";

export const CSV_COLUMNS = [
  "name", "layer", "lodging_type", "category", "lat", "lng", "opening_hours", "visit_duration_min",
  "price_min_vnd", "price_max_vnd", "price_status", "indoor", "vegetarian_friendly", "highlight_tags",
  "description", "address", "ward", "is_sponsored", "image_url", "source", "updated_at", "publish_status",
] as const;

/** Bọc ô trong ngoặc kép khi có dấu phẩy, ngoặc kép hoặc xuống dòng. */
const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export const CSV_TEMPLATE =
  CSV_COLUMNS.join(",") +
  "\n" +
  [
    "Lăng Khải Định", "heritage", "", "cat-tomb", "16.3990", "107.5904", '{"mon-sun":"07:00-17:30"}', "60",
    "150000", "150000", "estimated", "false", "", "architecture;photo_spot", "Lăng có nội thất khảm sành sứ",
    "Khải Định, Thủy Bằng", "", "false", "", "Trang chính thức Trung tâm Bảo tồn Di tích Cố đô Huế", "2026-10-25", "draft",
  ]
    .map(cell)
    .join(",") +
  "\n";

/** Danh mục mặc định khi file không có cột category. */
const DEFAULT_CATEGORY: Record<string, string> = {
  heritage: "cat-monument",
  attraction: "cat-landmark",
  food: "cat-local-food",
  hotel: "cat-hotel",
  homestay: "cat-homestay",
};

/** CSV tối giản theo RFC 4180: dấu phẩy, ngoặc kép, "" là ngoặc kép trong ô, xuống dòng trong ô có ngoặc. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, ""); // bỏ BOM của Excel
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export type CsvRowResult = { line: number; name: string; data?: PlaceInput; errors: string[] };

export function csvToPlaces(text: string): { header: string[]; missing: string[]; rows: CsvRowResult[] } {
  const table = parseCsv(text);
  if (table.length === 0) return { header: [], missing: ["name"], rows: [] };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const required = ["name", "layer", "lat", "lng", "price_status", "source", "updated_at"];
  const missing = required.filter((c) => !header.includes(c));
  const col = (r: string[], c: string) => (header.indexOf(c) >= 0 ? (r[header.indexOf(c)] ?? "").trim() : "");

  const rows = table.slice(1).map((r, i) => {
    const line = i + 2; // dòng 1 là tiêu đề
    const errors: string[] = [];
    const num = (c: string) => {
      const v = col(r, c);
      if (v === "") return null;
      const n = Number(v.replace(/[\s_]/g, ""));
      if (!Number.isFinite(n)) errors.push(`${c}: "${v}" không phải số`);
      return n;
    };
    const bool = (c: string) => {
      const v = col(r, c).toLowerCase();
      if (v === "") return null;
      if (["true", "1", "có", "co", "yes"].includes(v)) return true;
      if (["false", "0", "không", "khong", "no"].includes(v)) return false;
      errors.push(`${c}: "${v}" phải là true/false`);
      return null;
    };
    // AC-ADM-02: tọa độ sai định dạng → báo lỗi, không lưu dòng.
    const lat = Number(col(r, "lat").replace(",", "."));
    const lng = Number(col(r, "lng").replace(",", "."));
    if (!Number.isFinite(lat) || col(r, "lat") === "") errors.push(`lat: "${col(r, "lat")}" không phải tọa độ hợp lệ`);
    if (!Number.isFinite(lng) || col(r, "lng") === "") errors.push(`lng: "${col(r, "lng")}" không phải tọa độ hợp lệ`);

    let hours: Record<string, string> | null = null;
    if (col(r, "opening_hours")) {
      try {
        hours = JSON.parse(col(r, "opening_hours"));
      } catch {
        errors.push(`opening_hours: JSON không hợp lệ`);
      }
    }
    const layer = col(r, "layer");
    const lodging = col(r, "lodging_type");
    const candidate = {
      name: col(r, "name"),
      layer,
      lodging_type: lodging || null,
      primary_category_id: col(r, "category") || DEFAULT_CATEGORY[layer === "stay" ? lodging : layer] || "",
      lat,
      lng,
      opening_hours: hours,
      visit_duration_min: num("visit_duration_min"),
      price_min_vnd: num("price_min_vnd"),
      price_max_vnd: num("price_max_vnd"),
      price_status: col(r, "price_status") || "unknown",
      indoor: bool("indoor"),
      vegetarian_friendly: bool("vegetarian_friendly"),
      is_sponsored: bool("is_sponsored") ?? false,
      address: col(r, "address") || null,
      ward: col(r, "ward") || null,
      description: col(r, "description") || null,
      highlight_tags: col(r, "highlight_tags").split(/[;,]/).map((t) => t.trim()).filter(Boolean),
      image_url: col(r, "image_url") || null,
      source: col(r, "source"),
      updated_at: col(r, "updated_at"),
      publish_status: col(r, "publish_status") || "draft",
    };
    if (errors.length) return { line, name: candidate.name, errors };
    const parsed = placeInputSchema.safeParse(candidate);
    if (!parsed.success) {
      return { line, name: candidate.name, errors: parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`) };
    }
    return { line, name: candidate.name, data: parsed.data, errors: [] };
  });
  return { header, missing, rows };
}
