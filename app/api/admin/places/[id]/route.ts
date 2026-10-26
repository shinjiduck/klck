// GET    /api/admin/places/{id} – chi tiết (editor/admin).
// PATCH  /api/admin/places/{id} – sửa, xuất bản, ẩn (editor/admin). FR-ADM-02, FR-ADM-03, AC-ADM-01.
// DELETE /api/admin/places/{id} – xóa vĩnh viễn (chỉ admin – ma trận quyền). FR-ADM-03.

import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { placeInputSchema, toPlaceRow } from "@/lib/admin-types";
import { apiError, guardError, requireRole } from "@/lib/supabase/guard";
import { dbError } from "../db-error";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const g = await requireRole("staff");
  if (!g.ok) return guardError(g);
  const { id } = await params;
  const { data, error } = await g.ctx.supabase.from("place_rows").select("*").eq("id", id).maybeSingle();
  if (error) return dbError(error);
  if (!data) return apiError(404, "NOT_FOUND", "Không tìm thấy địa điểm.");
  return NextResponse.json({ place: data });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const g = await requireRole("staff");
  if (!g.ok) return guardError(g);
  const { id } = await params;

  const parsed = placeInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_INPUT", "Dữ liệu không hợp lệ", parsed.error.issues);

  const { data, error } = await g.ctx.supabase.from("places").update(toPlaceRow(parsed.data)).eq("id", id).select("id");
  if (error) return dbError(error);
  if (!data?.length) return apiError(404, "NOT_FOUND", "Không tìm thấy địa điểm.");
  revalidateTag("places", "max");
  return NextResponse.json({ id });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const g = await requireRole("admin");
  if (!g.ok) return guardError(g);
  const { id } = await params;
  const { data, error } = await g.ctx.supabase.from("places").delete().eq("id", id).select("id");
  if (error) return dbError(error);
  if (!data?.length) return apiError(404, "NOT_FOUND", "Không tìm thấy địa điểm.");
  revalidateTag("places", "max");
  return NextResponse.json({ id });
}
