// GET /api/admin/places – danh sách địa điểm mọi trạng thái (editor/admin). FR-ADM-01.
// POST /api/admin/places – thêm địa điểm (editor/admin). FR-ADM-02, AC-ADM-01.
// Kiểm tra quyền ở đây (401/403 – AC-ROLE-01) và ở RLS (SEC-ROLE-05). AUDIT_LOG do trigger ghi (SEC-ROLE-02).

import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { placeInputSchema, slugify, toPlaceRow } from "@/lib/admin-types";
import { apiError, guardError, requireRole } from "@/lib/supabase/guard";
import { dbError } from "./db-error";

export async function GET() {
  const g = await requireRole("staff");
  if (!g.ok) return guardError(g);
  const { data, error } = await g.ctx.supabase.from("place_rows").select("*").order("updated_at", { ascending: true });
  if (error) return dbError(error);
  return NextResponse.json({ places: data });
}

export async function POST(request: NextRequest) {
  const g = await requireRole("staff");
  if (!g.ok) return guardError(g);

  const parsed = placeInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_INPUT", "Dữ liệu không hợp lệ", parsed.error.issues);

  const base = slugify(parsed.data.name) || "dia-diem";
  const { data: taken } = await g.ctx.supabase.from("places").select("slug").like("slug", `${base}%`);
  const used = new Set((taken ?? []).map((r) => r.slug));
  let slug = base;
  for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;

  const { data, error } = await g.ctx.supabase
    .from("places")
    .insert({ ...toPlaceRow(parsed.data), slug })
    .select("id")
    .single();
  if (error) return dbError(error);
  revalidateTag("places", "max");
  return NextResponse.json({ id: data.id }, { status: 201 });
}
