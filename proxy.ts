// Proxy (Next.js 16, thay cho middleware): làm mới phiên Supabase Auth trên server trước khi vào khu vực
// cần kiểm tra quyền ở backend (/admin, /api). Các trang du khách vẫn prerender tĩnh nên không đi qua đây.
// Bản thân việc chặn quyền nằm ở trang/Route Handler (AC-ROLE-01, AC-ROLE-03) và RLS – proxy chỉ giữ phiên.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Gọi getUser() để làm mới token nếu sắp hết hạn (ghi cookie mới vào response).
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
