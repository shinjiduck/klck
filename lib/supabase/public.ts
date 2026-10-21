// Client Supabase không gắn phiên đăng nhập – chỉ đọc dữ liệu công khai (địa điểm đã xuất bản).
// Dùng được trong hàm "use cache" vì không đọc cookie. RLS quyết định dữ liệu trả về.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "./env";

export function createPublicClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
