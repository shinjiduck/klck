// GET /api/admin/users – danh sách tài khoản và vai trò (chỉ admin). FR-ADM-05.

import { NextResponse } from "next/server";
import { guardError, requireRole } from "@/lib/supabase/guard";
import { dbError } from "../places/db-error";

export async function GET() {
  const g = await requireRole("admin");
  if (!g.ok) return guardError(g);
  const { data, error } = await g.ctx.supabase.rpc("admin_list_users");
  if (error) return dbError(error);
  return NextResponse.json({ users: data, me: g.ctx.user.id });
}
