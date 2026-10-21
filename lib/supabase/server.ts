// Client Supabase phía server gắn phiên đăng nhập qua cookie (@supabase/ssr).
// Dùng trong Server Component / Route Handler / Server Function khi cần quyền của người dùng
// (lưu chuyến đi, trang Admin). Không dùng bên trong "use cache".

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "./env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Gọi từ Server Component (không ghi được cookie) – bỏ qua; proxy sẽ làm mới phiên.
        }
      },
    },
  });
}
