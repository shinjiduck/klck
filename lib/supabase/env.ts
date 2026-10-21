// Biến môi trường Supabase (xem SRS – "Biến môi trường").
// Khóa công khai: Supabase mới gọi là "publishable key" (sb_publishable_…), dự án cũ là "anon key".
// Điền một trong hai vào .env.local; cả hai đều an toàn ở trình duyệt khi đã bật RLS.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** false → app dùng dữ liệu giả trong lib/mock (GĐ1 chưa nối Supabase). */
export const isSupabaseConfigured = SUPABASE_URL !== "" && SUPABASE_PUBLIC_KEY !== "";

/** Nguồn dữ liệu đang dùng – để tách bản nháp chuyến đi giữa dữ liệu giả và dữ liệu thật. */
export const DATA_SOURCE: "supabase" | "mock" = isSupabaseConfigured ? "supabase" : "mock";
