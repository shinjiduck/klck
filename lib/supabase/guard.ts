// Kiểm tra quyền ở backend (SEC-ROLE-05: không dựa vào việc ẩn nút trên giao diện).
// Dùng trong Route Handler và Server Component của khu vực /admin.
// Mọi truy vấn sau đó vẫn chạy bằng phiên của chính người dùng → RLS là lớp chặn thứ hai.

import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/admin-types";
import { isSupabaseConfigured } from "./env";
import { createSupabaseServerClient } from "./server";

export type StaffContext = { supabase: SupabaseClient; user: User; role: AppRole };

export type GuardResult =
  | { ok: true; ctx: StaffContext }
  | { ok: false; status: 401 | 403 | 503; code: string; message: string };

/** need: "staff" = editor hoặc admin (quản lý địa điểm); "admin" = chỉ admin (người dùng, nhật ký, xóa vĩnh viễn). */
export async function requireRole(need: "staff" | "admin"): Promise<GuardResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, status: 503, code: "NOT_CONFIGURED", message: "Chưa cấu hình Supabase." };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, code: "UNAUTHENTICATED", message: "Bạn cần đăng nhập." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = (profile?.role ?? "traveler") as AppRole;
  const allowed = need === "admin" ? role === "admin" : role === "admin" || role === "editor";
  if (!allowed) return { ok: false, status: 403, code: "FORBIDDEN", message: "Bạn không có quyền truy cập." };
  return { ok: true, ctx: { supabase, user, role } };
}

/** Phản hồi lỗi theo quy ước SRS: { code, message, requestId, details? }. */
export function apiError(status: number, code: string, message: string, details?: unknown) {
  const requestId = crypto.randomUUID();
  return NextResponse.json({ code, message, requestId, ...(details !== undefined ? { details } : {}) }, { status });
}

export function guardError(g: Extract<GuardResult, { ok: false }>) {
  return apiError(g.status, g.code, g.message);
}
