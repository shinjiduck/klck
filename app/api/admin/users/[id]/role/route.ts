// PATCH /api/admin/users/{id}/role – đổi vai trò (chỉ admin). FR-ADM-05.
// SEC-ROLE-06 / AC-ROLE-05: không ai tự đổi vai trò của chính mình – chặn ở đây và ở trigger CSDL.
// AUDIT_LOG ghi role_change bằng trigger (AC-ROLE-04).

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, guardError, requireRole } from "@/lib/supabase/guard";
import { dbError } from "../../../places/db-error";

const bodySchema = z.object({ role: z.enum(["traveler", "partner", "editor", "admin"]) });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireRole("admin");
  if (!g.ok) return guardError(g);
  const { id } = await params;
  if (id === g.ctx.user.id) return apiError(403, "SELF_ROLE_CHANGE", "Không thể tự đổi vai trò của chính mình.");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_INPUT", "Vai trò không hợp lệ.");

  const { data, error } = await g.ctx.supabase.from("profiles").update({ role: parsed.data.role }).eq("id", id).select("id, role");
  if (error) return dbError(error);
  if (!data?.length) return apiError(404, "NOT_FOUND", "Không tìm thấy tài khoản.");
  return NextResponse.json({ id, role: data[0].role });
}
