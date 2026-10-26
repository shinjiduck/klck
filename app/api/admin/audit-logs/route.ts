// GET /api/admin/audit-logs?actor=&from=&to= – nhật ký thao tác (chỉ admin). FR-ADM-06, AC-ROLE-04.

import { NextResponse, type NextRequest } from "next/server";
import { guardError, requireRole } from "@/lib/supabase/guard";
import { dbError } from "../places/db-error";

export async function GET(request: NextRequest) {
  const g = await requireRole("admin");
  if (!g.ok) return guardError(g);
  const sp = request.nextUrl.searchParams;
  const day = (d: string | null, end = false) => {
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    const t = new Date(`${d}T00:00:00+07:00`);
    if (end) t.setUTCDate(t.getUTCDate() + 1);
    return t.toISOString();
  };
  const { data, error } = await g.ctx.supabase.rpc("admin_audit_log", {
    p_actor: sp.get("actor") || null,
    p_from: day(sp.get("from")),
    p_to: day(sp.get("to"), true),
    p_limit: 300,
  });
  if (error) return dbError(error);
  return NextResponse.json({ logs: data });
}
