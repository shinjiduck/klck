// Đổi lỗi Postgres/PostgREST sang mã HTTP theo quy ước SRS.

import type { PostgrestError } from "@supabase/supabase-js";
import { apiError } from "@/lib/supabase/guard";

export function dbError(error: PostgrestError) {
  // 42501: RLS hoặc trigger chặn quyền; PT403: hàm tự từ chối.
  if (error.code === "42501" || error.code === "PT403") return apiError(403, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
  if (error.code === "23514") return apiError(422, "RULE_VIOLATION", "Vi phạm quy tắc dữ liệu (ví dụ thiếu nguồn khi xuất bản).", error.message);
  if (error.code === "23505") return apiError(409, "CONFLICT", "Dữ liệu bị trùng.", error.message);
  if (error.code === "23503") return apiError(409, "IN_USE", "Địa điểm đang được dùng trong lịch trình của người dùng.", error.message);
  return apiError(500, "DB_ERROR", "Lỗi cơ sở dữ liệu.", error.message);
}
