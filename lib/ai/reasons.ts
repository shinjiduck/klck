// Claude API viết lại lý do "Hợp với bạn" bằng ngôn ngữ tự nhiên (SRS – Tích hợp Claude API).
// - AI CHỈ viết câu chữ. Có phù hợp hay không, giờ mở cửa, giá… do dữ liệu + quy tắc quyết định (BR-FEAS-01).
// - Đầu vào chỉ gồm dữ liệu địa điểm đã duyệt và lựa chọn sở thích; không gửi thông tin định danh người dùng.
// - Lưu kết quả theo cặp (địa điểm, tổ hợp sở thích) bằng "use cache" để không gọi AI lặp lại.
// - Lỗi / quá thời gian / bị từ chối → ném lỗi; Route Handler dùng câu mẫu theo reason code (không cache lỗi).
// - Khóa API chỉ ở server (ANTHROPIC_API_KEY, không có tiền tố NEXT_PUBLIC_).

import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { INTEREST_LABEL, TRAVEL_WITH_LABEL } from "@/lib/labels";
import { LAYER_LABEL } from "@/lib/places";
import type { Interest, Place, TravelWith } from "@/lib/types";

/** SRS gợi ý mô hình nhỏ cho câu ngắn: đổi qua ANTHROPIC_MODEL (vd. claude-haiku-5-5) nếu muốn rẻ hơn. */
export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
export const AI_PROMPT_VERSION = "reason-v1";

export function isAiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient() {
  // NFR-04: phải có phản hồi hữu ích ≤ 3 s – giao diện hiện câu mẫu ngay, câu AI thay vào khi về.
  // Giới hạn thời gian để không giữ kết nối lâu; chỉ thử lại 1 lần.
  client ??= new Anthropic({ timeout: 10_000, maxRetries: 1 });
  return client;
}

const ReasonSchema = z.object({
  reason: z.string().describe("Một câu tiếng Việt, tối đa 30 từ"),
});

const SYSTEM = `Bạn viết lý do ngắn vì sao một địa điểm ở Huế hợp với du khách, cho ứng dụng du lịch HueTrip.
Quy tắc:
- Một câu tiếng Việt tự nhiên, tối đa 30 từ, xưng "bạn".
- Nối trực tiếp lựa chọn của du khách với một đặc điểm cụ thể của địa điểm (ví dụ: "Bạn thích chụp ảnh – nội thất khảm sành sứ ở đây rất ăn ảnh").
- Chỉ dùng dữ kiện được cung cấp. Không bịa giờ mở cửa, giá, khoảng cách hay sự kiện.
- Không hứa hẹn tuyệt đối, không quảng cáo, không dùng câu chung chung như "rất đáng để ghé thăm".
- Không nhắc tới dữ liệu nội bộ, độ tin cậy hay việc cần xác minh.`;

export type ReasonInput = {
  place: Pick<Place, "id" | "name" | "layer" | "description" | "highlight_tags">;
  interests: Interest[];
  travelWith: TravelWith | null;
  vegetarian: boolean;
  /** Câu mẫu theo reason code – AI viết lại cho tự nhiên hơn, không đổi ý. */
  template: string;
};

/**
 * Viết lý do bằng Claude. Có "use cache": cùng địa điểm + cùng tổ hợp sở thích dùng lại kết quả.
 * Ném lỗi khi không dùng được kết quả (để không lưu cache câu sai).
 */
export async function writeReason(input: ReasonInput): Promise<{ text: string; model: string; version: string }> {
  "use cache";
  cacheLife("days");
  cacheTag("ai-reasons", `ai-reasons:${input.place.id}`);

  const facts = [
    `Địa điểm: ${input.place.name} (${LAYER_LABEL[input.place.layer]})`,
    input.place.description ? `Mô tả: ${input.place.description}` : null,
    input.place.highlight_tags.length ? `Điểm nổi bật (thẻ): ${input.place.highlight_tags.join(", ")}` : null,
    `Du khách chọn: ${input.interests.map((i) => INTEREST_LABEL[i]).join(", ")}`,
    input.travelWith ? `Đi cùng: ${TRAVEL_WITH_LABEL[input.travelWith]}` : null,
    input.vegetarian ? "Du khách ăn chay" : null,
    `Câu mẫu cần viết lại (giữ nguyên ý): ${input.template}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Claude Opus/Sonnet/Fable có fallback phía server khi bị bộ lọc an toàn từ chối; Haiku thì không.
  const supportsFallback = /^claude-(opus|sonnet|fable)/.test(AI_MODEL);

  const response = await getClient().beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    // Câu ngắn, việc đơn giản → effort thấp cho nhanh và rẻ.
    output_config: { effort: "low", format: betaZodOutputFormat(ReasonSchema) },
    ...(supportsFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    messages: [{ role: "user", content: facts }],
  });

  if (response.stop_reason === "refusal") throw new Error("AI từ chối viết lý do");
  const text = response.parsed_output?.reason?.trim();
  if (!text || text.length > 300) throw new Error("AI trả về lý do không hợp lệ");
  return { text, model: response.model, version: AI_PROMPT_VERSION };
}
