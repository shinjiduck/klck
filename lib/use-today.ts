"use client";

// Ngày hôm nay (giờ Việt Nam) chỉ đọc ở trình duyệt: trang được prerender tĩnh nên không dùng ngày lúc build.
// null khi đang render ở server / trước hydrate.

import { useSyncExternalStore } from "react";
import { todayInHue } from "@/lib/places";

const noop = () => () => {};

export function useToday(): string | null {
  return useSyncExternalStore(noop, todayInHue, () => null);
}
