"use client";

// Trạng thái đăng nhập phía trình duyệt (Supabase Auth). UX-08.
// "disabled" = chưa cấu hình Supabase → app chạy chế độ dữ liệu giả, không yêu cầu đăng nhập.

import { useSyncExternalStore } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export type AuthUser = { id: string; email: string | null };
export type AuthState =
  | { status: "disabled"; user: null }
  | { status: "loading"; user: null }
  | { status: "signed_out"; user: null }
  | { status: "signed_in"; user: AuthUser };

const DISABLED: AuthState = { status: "disabled", user: null };
const LOADING: AuthState = { status: "loading", user: null };

let state: AuthState = isSupabaseConfigured ? LOADING : DISABLED;
let started = false;
const listeners = new Set<() => void>();

function set(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

function start() {
  if (started || !isSupabaseConfigured) return;
  started = true;
  const supabase = getSupabaseBrowserClient();
  // onAuthStateChange phát INITIAL_SESSION ngay khi đăng ký nghe, rồi SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED.
  supabase.auth.onAuthStateChange((_event, session) => {
    const u = session?.user;
    if (!u) {
      if (state.status !== "signed_out") set({ status: "signed_out", user: null });
    } else if (state.status !== "signed_in" || state.user.id !== u.id) {
      set({ status: "signed_in", user: { id: u.id, email: u.email ?? null } });
    }
  });
}

function subscribe(cb: () => void) {
  start();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => (isSupabaseConfigured ? LOADING : DISABLED),
  );
}

/** true khi thao tác cần đăng nhập mà người dùng chưa đăng nhập (ma trận quyền: Khách không lưu/sửa lịch). */
export function needsLogin(auth: AuthState): boolean {
  return auth.status === "signed_out" || auth.status === "loading";
}

export async function signOut() {
  if (!isSupabaseConfigured) return;
  await getSupabaseBrowserClient().auth.signOut();
}

/** Chỉ cho phép quay về đường dẫn nội bộ (chống chuyển hướng mở sang trang lạ). */
export function safeNext(next: string | null | undefined, fallback = "/trip"): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
