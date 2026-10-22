"use client";

// Client Supabase ở trình duyệt (đăng nhập, lưu chuyến đi của chính mình – RLS kiểm soát).

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "./env";

let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
  return client;
}
