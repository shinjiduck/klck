// FR-ADM-08 / AC-ADM-04: lấy địa điểm ở Huế từ OpenStreetMap (Overpass API) → file CSV theo mẫu nhập của Admin (FR-ADM-04).
// Chạy: npm run data:osm            (tùy chọn: --bbox=south,west,north,east)
// Kết quả: data/osm/hue-osm-<ngày>-<n>.csv (≤ 500 dòng mỗi file, đúng giới hạn route nhập)
//          data/osm/hue-osm-<ngày>-report.md (điểm bị bỏ vì trùng, giờ mở cửa chưa đổi được).
//
// Nguyên tắc (SRS: hệ thống tự lưu dữ liệu địa điểm; BR-SOURCE-01, BR-PRICE-01):
// - Mọi dòng ở trạng thái "draft": admin kiểm tra, bổ sung giá/giờ/thời gian tham quan rồi mới xuất bản.
// - Giá luôn "unknown" vì OSM không có giá vé.
// - Nguồn ghi rõ OSM + giấy phép ODbL + link tới đối tượng gốc.
// - Route nhập upsert theo slug (tên) → điểm trùng tên với điểm đã có sẽ BỊ BỎ để không ghi đè dữ liệu đã duyệt;
//   các điểm OSM trùng tên nhau được thêm tên đường để thành tên riêng.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CSV_COLUMNS } from "../lib/csv-import";
import { slugify } from "../lib/admin-types";
import { MOCK_PLACES } from "../lib/mock/places";

// ---------- Cấu hình ----------

/** Khung mặc định: nội thành Huế + khu lăng tẩm phía nam + biển Thuận An. Phải nằm trong giới hạn của placeInputSchema. */
const DEFAULT_BBOX = { south: 16.36, west: 107.48, north: 16.57, east: 107.68 };
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const MAX_ROWS_PER_FILE = 500;
const DUP_RADIUS_M = 100;

const bboxArg = process.argv.find((a) => a.startsWith("--bbox="));
const bbox = bboxArg
  ? (() => {
      const [south, west, north, east] = bboxArg.slice(7).split(",").map(Number);
      return { south, west, north, east };
    })()
  : DEFAULT_BBOX;

try {
  process.loadEnvFile(".env.local");
} catch {
  // không có .env.local → chỉ lọc trùng với dữ liệu giả
}

// ---------- Kiểu ----------

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type Existing = { slug: string; name: string; lat: number; lng: number };

type Row = Record<(typeof CSV_COLUMNS)[number], string>;

type Candidate = {
  osm: string;
  name: string;
  lat: number;
  lng: number;
  layer: "heritage" | "attraction" | "food" | "stay";
  lodging: "" | "hotel" | "homestay";
  category: string;
  indoor: boolean | null;
  vegetarian: boolean | null;
  hours: Record<string, string> | null;
  rawHours: string | null;
  address: string;
  ward: string;
  street: string;
  description: string;
  image: string;
  tags: string[];
};

// ---------- Truy vấn Overpass ----------

function overpassQuery(): string {
  const b = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const sel = [
    `nwr["historic"]["name"](${b});`,
    `nwr["amenity"="place_of_worship"]["name"](${b});`,
    `nwr["tourism"~"^(attraction|museum|viewpoint|gallery|hotel|motel|guest_house|hostel|apartment)$"]["name"](${b});`,
    `nwr["amenity"~"^(restaurant|cafe|fast_food|food_court|marketplace)$"]["name"](${b});`,
    `nwr["leisure"~"^(park|garden)$"]["name"](${b});`,
    `nwr["natural"="beach"]["name"](${b});`,
  ];
  return `[out:json][timeout:120];(${sel.join("")});out center tags;`;
}

/** Máy chủ chính hay quá tải (502/504/429) → thử lần lượt các máy chủ Overpass công khai khác, mỗi vòng chờ lâu hơn. */
async function fetchOsm(): Promise<OsmElement[]> {
  const body = "data=" + encodeURIComponent(overpassQuery());
  let lastError = "";
  for (let round = 0; round < 3; round++) {
    for (const url of OVERPASS_URLS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "HueTrip-data-import/1.0" },
          body,
          signal: AbortSignal.timeout(180_000),
        });
        if (res.ok) {
          console.log(`  ✓ ${url}`);
          return ((await res.json()) as { elements: OsmElement[] }).elements;
        }
        lastError = `${url} → ${res.status}`;
      } catch (err) {
        lastError = `${url} → ${err instanceof Error ? (err.cause as Error)?.message ?? err.message : err}`;
      }
      console.warn(`  ✗ ${lastError}`);
    }
    await new Promise((r) => setTimeout(r, 10_000 * (round + 1)));
  }
  throw new Error(`Không máy chủ Overpass nào phản hồi. Lỗi cuối: ${lastError}`);
}

// ---------- Điểm đã có (để không ghi đè) ----------

async function fetchExisting(): Promise<Existing[]> {
  const list: Existing[] = MOCK_PLACES.map((p) => ({
    slug: p.id,
    name: p.name,
    lat: p.location.lat,
    lng: p.location.lng,
  }));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.warn("⚠ Chưa cấu hình Supabase → chỉ lọc trùng với dữ liệu giả lib/mock/places.ts.");
    return list;
  }
  const res = await fetch(`${url}/rest/v1/place_rows?select=slug,name,lat,lng&limit=10000`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  }).catch(() => null);
  if (!res?.ok) {
    console.warn(`⚠ Không đọc được place_rows từ Supabase (${res?.status ?? "lỗi mạng"}) → chỉ lọc trùng với dữ liệu giả.`);
    return list;
  }
  const rows = (await res.json()) as Existing[];
  console.log(`Đã đọc ${rows.length} địa điểm đã xuất bản trên Supabase để lọc trùng.`);
  return list.concat(rows);
}

// ---------- Phân loại ----------

const isTomb = (name: string) => /^(lăng|lang)\s/i.test(name);

function classify(t: Record<string, string>, name: string): Pick<Candidate, "layer" | "lodging" | "category" | "indoor"> | null {
  const tourism = t.tourism ?? "";
  const amenity = t.amenity ?? "";
  if (["hotel", "motel"].includes(tourism)) return { layer: "stay", lodging: "hotel", category: "cat-hotel", indoor: true };
  if (["guest_house", "hostel", "apartment"].includes(tourism))
    return { layer: "stay", lodging: "homestay", category: "cat-homestay", indoor: true };

  if (["restaurant", "cafe", "fast_food", "food_court"].includes(amenity)) {
    const veg = t["diet:vegetarian"] === "only" || /\bchay\b/i.test(name);
    const category = veg
      ? "cat-vegetarian"
      : amenity === "cafe"
        ? "cat-cafe"
        : amenity === "restaurant"
          ? "cat-restaurant"
          : "cat-local-food";
    return { layer: "food", lodging: "", category, indoor: null };
  }
  if (amenity === "marketplace") return { layer: "attraction", lodging: "", category: "cat-market", indoor: null };

  if (t.historic === "tomb" || isTomb(name)) return { layer: "heritage", lodging: "", category: "cat-tomb", indoor: false };
  if (amenity === "place_of_worship") return { layer: "heritage", lodging: "", category: "cat-pagoda", indoor: null };
  if (tourism === "museum" || tourism === "gallery") return { layer: "heritage", lodging: "", category: "cat-monument", indoor: true };
  if (t.historic) return { layer: "heritage", lodging: "", category: "cat-monument", indoor: null };

  if (tourism === "attraction" || tourism === "viewpoint" || t.leisure || t.natural)
    return { layer: "attraction", lodging: "", category: "cat-landmark", indoor: false };
  return null;
}

// ---------- Giờ mở cửa OSM → định dạng của HueTrip ----------

const DAY: Record<string, string> = { Mo: "mon", Tu: "tue", We: "wed", Th: "thu", Fr: "fri", Sa: "sat", Su: "sun" };
const TIME = /^([01]?\d|2[0-4]):[0-5]\d-([01]?\d|2[0-4]):[0-5]\d$/;
const pad = (s: string) => s.replace(/(^|-)(\d):/g, "$10$2:");

/** Đổi các dạng phổ biến ("Mo-Su 07:00-17:30", "Mo-Fr 08:00-17:00; Sa off", "24/7"). Dạng khó (PH, tháng, sunrise) → null. */
export function convertHours(raw: string): Record<string, string> | null {
  const s = raw.trim();
  if (s === "24/7") return { "mon-sun": "00:00-24:00" };
  const out: Record<string, string> = {};
  for (const part of s.split(";").map((p) => p.trim()).filter(Boolean)) {
    const m = part.match(/^([A-Z][a-z](?:-[A-Z][a-z])?(?:,[A-Z][a-z](?:-[A-Z][a-z])?)*)?\s*(.+)$/);
    if (!m) return null;
    const days = m[1] ?? "Mo-Su";
    const value = m[2].trim();
    let hv: string;
    if (/^(off|closed)$/i.test(value)) hv = "closed";
    else {
      const ranges = value.split(",").map((r) => r.trim());
      if (!ranges.every((r) => TIME.test(r))) return null;
      hv = ranges.map(pad).join(",");
    }
    for (const d of days.split(",")) {
      const [a, b] = d.split("-");
      if (!DAY[a] || (b && !DAY[b])) return null;
      out[b ? `${DAY[a]}-${DAY[b]}` : DAY[a]] = hv;
    }
  }
  return Object.keys(out).length ? out : null;
}

// ---------- Tiện ích ----------

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Hai tên coi là cùng một nơi khi bản không dấu của tên này chứa tên kia. */
const sameName = (a: string, b: string) => {
  const x = slugify(a);
  const y = slugify(b);
  return x === y || x.includes(y) || y.includes(x);
};

const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

function toCandidate(e: OsmElement): Candidate | null {
  const t = e.tags ?? {};
  const name = (t["name:vi"] || t.name || "").trim();
  const lat = e.lat ?? e.center?.lat;
  const lng = e.lon ?? e.center?.lon;
  if (name.length < 2 || lat == null || lng == null) return null;
  if (lat < 16.2 || lat > 16.7 || lng < 107.3 || lng > 107.9) return null;
  const cls = classify(t, name);
  if (!cls) return null;
  const rawHours = t.opening_hours?.trim() || null;
  const street = t["addr:street"]?.trim() ?? "";
  const tags: string[] = [];
  if (t.tourism === "viewpoint") tags.push("photo_spot");
  if (t.heritage || t["heritage:operator"] === "whc") tags.push("unesco");
  const image = t.image?.startsWith("http") ? t.image : "";
  return {
    osm: `${e.type}/${e.id}`,
    name: name.slice(0, 100),
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    ...cls,
    vegetarian: t["diet:vegetarian"] === "only" || t["diet:vegetarian"] === "yes" ? true : null,
    hours: rawHours ? convertHours(rawHours) : null,
    rawHours,
    address: [t["addr:housenumber"], street].filter(Boolean).join(" ").slice(0, 200),
    ward: (t["addr:subdistrict"] || t["addr:quarter"] || "").slice(0, 100),
    street,
    description: (t["description:vi"] || t.description || "").slice(0, 1000),
    image,
    tags,
  };
}

function toRow(c: Candidate, today: string): Row {
  return {
    name: c.name,
    layer: c.layer,
    lodging_type: c.lodging,
    category: c.category,
    lat: String(c.lat),
    lng: String(c.lng),
    opening_hours: c.hours ? JSON.stringify(c.hours) : "",
    visit_duration_min: "",
    price_min_vnd: "",
    price_max_vnd: "",
    price_status: "unknown",
    indoor: c.indoor == null ? "" : String(c.indoor),
    vegetarian_friendly: c.vegetarian == null ? "" : String(c.vegetarian),
    highlight_tags: c.tags.join(";"),
    description: c.description,
    address: c.address,
    ward: c.ward,
    is_sponsored: "false",
    image_url: c.image,
    source: `OpenStreetMap (© OpenStreetMap contributors, ODbL) – https://www.openstreetmap.org/${c.osm}`,
    updated_at: today,
    publish_status: "draft",
  };
}

// ---------- Chạy ----------

async function main() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  console.log(`Đang tải dữ liệu OSM cho khung ${JSON.stringify(bbox)}…`);
  const [elements, existing] = await Promise.all([fetchOsm(), fetchExisting()]);
  console.log(`Overpass trả ${elements.length} đối tượng.`);

  const existingSlugs = new Set(existing.map((p) => p.slug).concat(existing.map((p) => slugify(p.name))));
  const skipped: string[] = [];
  const kept: Candidate[] = [];

  for (const e of elements) {
    const c = toCandidate(e);
    if (!c) continue;
    // 1) Trùng điểm đã có trong hệ thống (cùng slug, hoặc tên giống nhau trong bán kính 100 m) → bỏ, không ghi đè.
    const hit = existing.find(
      (p) => p.slug === slugify(c.name) || slugify(p.name) === slugify(c.name) || (distanceM(p, c) <= DUP_RADIUS_M && sameName(p.name, c.name)),
    );
    if (hit) {
      skipped.push(`- ${c.name} (${c.osm}) – trùng điểm đã có "${hit.name}"`);
      continue;
    }
    // 2) Một nơi có cả node và way trên OSM → giữ một.
    if (kept.some((k) => distanceM(k, c) <= DUP_RADIUS_M && slugify(k.name) === slugify(c.name))) continue;
    kept.push(c);
  }

  // 3) Tên trùng nhau ở các chỗ khác nhau (vd. nhiều quán "Bún bò Huế") → thêm tên đường, rồi số thứ tự.
  const used = new Set(existingSlugs);
  const bySlug = new Map<string, Candidate[]>();
  for (const c of kept) bySlug.set(slugify(c.name), [...(bySlug.get(slugify(c.name)) ?? []), c]);
  for (const group of bySlug.values()) {
    if (group.length === 1) {
      used.add(slugify(group[0].name));
      continue;
    }
    for (const c of group) {
      let name = c.street ? `${c.name} (${c.street})` : c.name;
      let i = 2;
      while (used.has(slugify(name))) name = `${c.street ? `${c.name} (${c.street})` : c.name} #${i++}`;
      c.name = name;
      used.add(slugify(name));
    }
  }

  kept.sort((a, b) => a.layer.localeCompare(b.layer) || a.name.localeCompare(b.name, "vi"));
  const rows = kept.map((c) => toRow(c, today));

  const dir = join(process.cwd(), "data", "osm");
  mkdirSync(dir, { recursive: true });
  const files: string[] = [];
  for (let i = 0; i < rows.length; i += MAX_ROWS_PER_FILE) {
    const chunk = rows.slice(i, i + MAX_ROWS_PER_FILE);
    const csv =
      "﻿" +
      CSV_COLUMNS.join(",") +
      "\n" +
      chunk.map((r) => CSV_COLUMNS.map((col) => cell(r[col])).join(",")).join("\n") +
      "\n";
    const file = join(dir, `hue-osm-${today}-${files.length + 1}.csv`);
    writeFileSync(file, csv, "utf8");
    files.push(file);
  }

  // SQL dán vào Supabase SQL Editor (khi chưa đăng nhập được trang Admin). `do nothing` → không bao giờ ghi đè
  // điểm đã có, kể cả điểm nháp chưa đọc được lúc chạy script. Trigger places_audit vẫn ghi AUDIT_LOG.
  const q = (v: string | null) => (v ? `'${v.replace(/'/g, "''")}'` : "null");
  const sqlValues = kept.map(
    (c) =>
      `  (${q(slugify(c.name))}, ${q(c.name)}, extensions.st_setsrid(extensions.st_makepoint(${c.lng}, ${c.lat}), 4326)::extensions.geography, ` +
      `${q(c.category)}, ${c.hours ? `${q(JSON.stringify(c.hours))}::jsonb` : "null"}, 'unknown', ${c.indoor ?? "null"}, ` +
      `${q(`OpenStreetMap (© OpenStreetMap contributors, ODbL) – https://www.openstreetmap.org/${c.osm}`)}, '${today}T00:00:00+07:00', false, 'draft', ` +
      `${q(c.layer)}, ${q(c.lodging || null)}, ${c.vegetarian ?? "null"}, ${q(c.address || null)}, ${q(c.ward || null)}, ` +
      `${q(c.description || null)}, array[${c.tags.map(q).join(", ")}]::text[], ${q(c.image || null)})`,
  );
  const sql = [
    `-- Nhập ${kept.length} địa điểm từ OpenStreetMap (${today}) – FR-ADM-08. Sinh bởi \`npm run data:osm\`.`,
    "-- Supabase → SQL Editor → dán → Run. Chạy lại nhiều lần được; điểm trùng slug được bỏ qua, không ghi đè.",
    "-- Tất cả ở trạng thái Nháp: không hiện trên Hue Map cho tới khi admin duyệt và xuất bản.",
    "",
    "with inserted as (",
    "insert into public.places (slug, name, location, primary_category_id, opening_hours, price_status, indoor,",
    "  source, updated_at, is_sponsored, publish_status, layer, lodging_type, vegetarian_friendly, address, ward,",
    "  description, highlight_tags, image_url) values",
    sqlValues.join(",\n"),
    "on conflict (slug) do nothing",
    "returning 1)",
    "select count(*) as so_diem_da_them from inserted;",
    "",
  ].join("\n");
  const sqlFile = join(dir, `hue-osm-${today}.sql`);
  writeFileSync(sqlFile, sql, "utf8");
  files.push(sqlFile);

  const count = (layer: string) => kept.filter((c) => c.layer === layer).length;
  const unparsed = kept.filter((c) => c.rawHours && !c.hours);
  const report = [
    `# Nhập OSM ngày ${today}`,
    "",
    `Khung: ${JSON.stringify(bbox)}`,
    "",
    `- Tổng giữ lại: **${kept.length}** (di tích ${count("heritage")}, điểm du lịch ${count("attraction")}, ăn uống ${count("food")}, lưu trú ${count("stay")})`,
    `- Có giờ mở cửa: ${kept.filter((c) => c.hours).length}`,
    `- Bỏ vì trùng điểm đã có: ${skipped.length}`,
    "",
    "Tất cả ở trạng thái **Nháp**, giá `unknown`. Trước khi xuất bản: kiểm tra vị trí, danh mục, bổ sung giá, giờ mở cửa, thời gian tham quan, ảnh.",
    "",
    "## Bị bỏ vì trùng",
    ...(skipped.length ? skipped : ["(không có)"]),
    "",
    "## Giờ mở cửa OSM chưa đổi tự động được (nhập tay)",
    ...(unparsed.length ? unparsed.map((c) => `- ${c.name}: \`${c.rawHours}\``) : ["(không có)"]),
    "",
  ].join("\n");
  const reportFile = join(dir, `hue-osm-${today}-report.md`);
  writeFileSync(reportFile, report, "utf8");

  console.log(
    `\n✔ ${kept.length} địa điểm → ${files.length - 1} file CSV + 1 file SQL (di tích ${count("heritage")}, điểm du lịch ${count("attraction")}, ăn uống ${count("food")}, lưu trú ${count("stay")}).`,
  );
  console.log(`  Bỏ ${skipped.length} điểm trùng với dữ liệu đã có. Báo cáo: ${reportFile}`);
  for (const f of files) console.log(`  ${f}`);
  console.log(
    "\nTiếp theo (chọn một): /admin/import → chọn từng file CSV → Lưu; hoặc dán file .sql vào Supabase SQL Editor → Run." +
      "\nCác điểm vào ở trạng thái Nháp.",
  );
}

main().catch((err) => {
  console.error("✘ Lỗi:", err instanceof Error ? err.message : err);
  process.exit(1);
});
