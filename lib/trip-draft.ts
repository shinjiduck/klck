"use client";

// Bản nháp chuyến đi trên trình duyệt.
// FR-F1-01 / AC-F1-01: khách xem và tạo bản nháp không cần tài khoản.
// Đã đăng nhập: đây là bản sao của chuyến đi trên Supabase (lib/trip-sync.ts), `server` ghi
// trip_id + version_no để lưu phiên bản tiếp theo có khóa lạc quan (BR-VERSION-01).

import { useSyncExternalStore } from "react";
import { DATA_SOURCE } from "@/lib/supabase/env";
import type { GeneratedPlan, TripInput, UserPreference } from "@/lib/types";

// Tách theo nguồn dữ liệu: id địa điểm giả ('p-dai-noi') khác id thật trong Supabase (uuid),
// nên bản nháp tạo trên dữ liệu giả không dùng tiếp được khi chuyển sang Supabase.
const KEY = `huetrip:draft:v1:${DATA_SOURCE}`;

export type TripDraft = {
  input: TripInput;
  /** Phương án người dùng đã chọn ở UX-04 (ảnh chụp tại thời điểm chọn). */
  selected: GeneratedPlan | null;
  updated_at: string;
  /** Có khi chuyến đi đã lưu lên Supabase. */
  server?: { trip_id: string; version_no: number; user_id: string };
};

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedValue: TripDraft | null = null;

function read(): TripDraft | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    cachedValue = raw ? (JSON.parse(raw) as TripDraft) : null;
  } catch {
    cachedValue = null;
  }
  return cachedValue;
}

function write(next: TripDraft | null) {
  try {
    if (next) window.localStorage.setItem(KEY, JSON.stringify(next));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Chế độ ẩn danh / bị chặn lưu trữ: vẫn chạy trong phiên hiện tại.
    cachedRaw = next ? JSON.stringify(next) : null;
    cachedValue = next;
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** undefined = chưa đọc được (đang render ở server / trước hydrate). */
export function useTripDraft(): TripDraft | null | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}

export function saveTripInput(input: TripInput) {
  const prev = read();
  // Đổi đầu vào thì phương án đã chọn cũ không còn đúng.
  const same = prev && JSON.stringify(prev.input) === JSON.stringify(input);
  // Giữ liên kết với chuyến đi trên server: lần lưu sau sẽ là phiên bản mới của cùng chuyến.
  write({ input, selected: same ? prev.selected : null, updated_at: new Date().toISOString(), server: prev?.server });
}

/** Đọc bản nháp hiện tại ngoài React (dùng khi đồng bộ). */
export function readTripDraft(): TripDraft | null {
  return read();
}

/** Thay toàn bộ bản nháp (ví dụ: nạp chuyến đi từ Supabase khi đăng nhập). */
export function replaceTripDraft(next: TripDraft | null) {
  write(next);
}

/** Ghi nhận phiên bản vừa lưu thành công lên server. */
export function setServerInfo(server: NonNullable<TripDraft["server"]>) {
  const prev = read();
  if (prev) write({ ...prev, server });
}

export function selectPlan(plan: GeneratedPlan) {
  const prev = read();
  if (!prev) return;
  write({ ...prev, selected: plan, updated_at: new Date().toISOString() });
}

/** Lưu lịch đã sửa (thêm/xóa điểm). Mọi nơi đang dùng useTripDraft cập nhật ngay (AC-F8.3-04). */
export function updateSelectedPlan(plan: GeneratedPlan) {
  selectPlan(plan);
}

export function clearTripDraft() {
  write(null);
}

/** Sở thích dùng cho nhãn "Hợp với bạn" trên Hue Map. */
export function preferenceFromDraft(draft: TripDraft | null | undefined): UserPreference | null {
  if (!draft) return null;
  const { input } = draft;
  return {
    user_id: null,
    interests: input.interests,
    must_haves: input.must_have_place_ids.length ? { place_ids: input.must_have_place_ids } : null,
    dietary: input.dietary,
    travel_with: input.travel_with,
  };
}
