// POST /api/admin/places/import – nhập hàng loạt (editor/admin). FR-ADM-04, AC-ADM-02.
// Trình duyệt đã đọc CSV và báo dòng lỗi trước; server kiểm tra lại từng dòng và chỉ lưu dòng hợp lệ.
// Dòng trùng slug (cùng tên) được cập nhật thay vì tạo bản sao.

import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { placeInputSchema, slugify, toPlaceRow } from "@/lib/admin-types";
import { apiError, guardError, requireRole } from "@/lib/supabase/guard";

const MAX_ROWS = 500;

export async function POST(request: NextRequest) {
  const g = await requireRole("staff");
  if (!g.ok) return guardError(g);

  const body = (await request.json().catch(() => null)) as { rows?: { line: number; data: unknown }[] } | null;
  if (!body?.rows || !Array.isArray(body.rows)) return apiError(400, "INVALID_INPUT", "Thiếu danh sách dòng cần nhập.");
  if (body.rows.length > MAX_ROWS) return apiError(400, "TOO_MANY_ROWS", `Tối đa ${MAX_ROWS} dòng mỗi lần.`);

  const results: { line: number; ok: boolean; message?: string }[] = [];
  const valid: Record<string, unknown>[] = [];
  for (const row of body.rows) {
    const parsed = placeInputSchema.safeParse(row.data);
    if (!parsed.success) {
      results.push({ line: row.line, ok: false, message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
      continue;
    }
    valid.push({ ...toPlaceRow(parsed.data), slug: slugify(parsed.data.name) });
    results.push({ line: row.line, ok: true });
  }

  if (valid.length) {
    const { error } = await g.ctx.supabase.from("places").upsert(valid, { onConflict: "slug" });
    if (error) {
      const forbidden = error.code === "42501";
      return apiError(forbidden ? 403 : 500, forbidden ? "FORBIDDEN" : "DB_ERROR", "Không lưu được dữ liệu nhập.", error.message);
    }
    revalidateTag("places", "max");
  }
  return NextResponse.json({ saved: valid.length, failed: results.filter((r) => !r.ok).length, results });
}
