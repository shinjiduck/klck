"use client";

// Hành động chờ khi khách bấm thao tác cần đăng nhập (AC-F8.3-01, UC-05 1a):
// lưu lại → đi đăng nhập → quay về đúng trang, trang đó lấy hành động ra và làm tiếp.

import type { PlanType } from "@/lib/types";

export type PendingAction =
  | { type: "select_plan"; plan_type: PlanType }
  | { type: "add_place"; place_id: string };

const KEY = "huetrip:pending:v1";
/** Hành động quá 30 phút coi như bỏ. */
const TTL_MS = 30 * 60 * 1000;

export function setPendingAction(action: PendingAction) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ action, at: Date.now() }));
  } catch {
    // bị chặn lưu trữ: bỏ qua, người dùng chỉ phải bấm lại sau khi đăng nhập
  }
}

/** Lấy và xóa hành động chờ nếu khớp loại cần tìm. */
export function takePendingAction<T extends PendingAction["type"]>(
  type: T,
): Extract<PendingAction, { type: T }> | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { action, at } = JSON.parse(raw) as { action: PendingAction; at: number };
    if (Date.now() - at > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    if (action.type !== type) return null;
    localStorage.removeItem(KEY);
    return action as Extract<PendingAction, { type: T }>;
  } catch {
    return null;
  }
}
