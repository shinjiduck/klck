// POST /api/reasons – lý do "Hợp với bạn" viết bằng Claude, có câu mẫu dự phòng (SRS – Tích hợp Claude API).
// Body: { place_id, interests[], travel_with?, vegetarian? } – chỉ lựa chọn sở thích, không có thông tin định danh.
// Luôn trả 200 kèm `source`: "ai" | "template" để giao diện biết đang hiện câu nào (NFR-04: có dự phòng khi lỗi).
// NFR-06: giới hạn tần suất gọi AI theo IP.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AI_MODEL, isAiConfigured, writeReason } from "@/lib/ai/reasons";
import { getPublishedPlaces } from "@/lib/data/places";
import { getPlaceMatch } from "@/lib/places";
import { apiError } from "@/lib/supabase/guard";

const bodySchema = z.object({
  place_id: z.string().min(1).max(64),
  interests: z.array(z.enum(["heritage", "food", "photo", "nature", "nightlife"])).min(1).max(5),
  travel_with: z.enum(["solo", "couple", "friends", "family_kids", "seniors"]).nullable().optional(),
  vegetarian: z.boolean().optional(),
});

// Giới hạn đơn giản trong bộ nhớ: 30 lần gọi AI / phút / IP. Đủ cho bản demo; GĐ2 thay bằng kho dùng chung.
const WINDOW_MS = 60_000;
const LIMIT = 30;
const hits = new Map<string, { count: number; reset: number }>();
function allow(ip: string) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  h.count++;
  return h.count <= LIMIT;
}

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_INPUT", "Dữ liệu không hợp lệ", parsed.error.issues);
  const { place_id, interests, travel_with = null, vegetarian = false } = parsed.data;

  // Chỉ dùng dữ liệu đã duyệt (địa điểm đã xuất bản).
  const place = (await getPublishedPlaces()).find((p) => p.id === place_id);
  if (!place) return apiError(404, "NOT_FOUND", "Không tìm thấy địa điểm.");

  const match = getPlaceMatch(place, {
    user_id: null,
    interests,
    must_haves: null,
    dietary: vegetarian ? ["vegetarian"] : [],
    travel_with,
  });
  // AC-F8.4-03: không đủ dữ liệu / không khớp sở thích → không viết câu khẳng định.
  if (!match) return NextResponse.json({ text: null, source: "none" });
  const template = match.reasons[0].text;

  if (!isAiConfigured()) return NextResponse.json({ text: template, source: "template" });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allow(ip)) return NextResponse.json({ text: template, source: "template", note: "rate_limited" });

  try {
    const ai = await writeReason({
      // Sắp xếp để cùng tổ hợp sở thích dùng chung một mục cache.
      place: { id: place.id, name: place.name, layer: place.layer, description: place.description, highlight_tags: place.highlight_tags },
      interests: [...interests].sort(),
      travelWith: travel_with,
      vegetarian,
      template,
    });
    return NextResponse.json({ text: ai.text, source: "ai", model: ai.model, version: ai.version });
  } catch (e) {
    console.error(`[reasons] ${AI_MODEL} lỗi, dùng câu mẫu:`, e instanceof Error ? e.message : e);
    return NextResponse.json({ text: template, source: "template" });
  }
}
