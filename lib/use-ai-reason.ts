"use client";

// Lấy lý do "Hợp với bạn" do Claude viết (POST /api/reasons). Trong lúc chờ, giao diện hiện câu mẫu.
// Chỉ gửi id địa điểm + lựa chọn sở thích (không định danh người dùng).

import { useEffect, useState } from "react";
import type { UserPreference } from "@/lib/types";

export type AiReason = { text: string; source: "ai" | "template" } | null;

const memo = new Map<string, AiReason>();

export function useAiReason(placeId: string, pref: UserPreference | null, enabled: boolean): AiReason {
  const key = pref
    ? JSON.stringify([placeId, [...pref.interests].sort(), pref.travel_with, pref.dietary.includes("vegetarian")])
    : null;
  const [result, setResult] = useState<{ key: string; value: AiReason } | null>(null);

  useEffect(() => {
    if (!enabled || !key || !pref || memo.has(key)) return;
    let alive = true;
    fetch("/api/reasons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        place_id: placeId,
        interests: pref.interests,
        travel_with: pref.travel_with,
        vegetarian: pref.dietary.includes("vegetarian"),
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { text: string | null; source: string } | null) => {
        const value: AiReason =
          d?.text && (d.source === "ai" || d.source === "template") ? { text: d.text, source: d.source } : null;
        memo.set(key, value);
        if (alive) setResult({ key, value });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // key đại diện cho pref + placeId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  if (!key) return null;
  if (memo.has(key)) return memo.get(key)!;
  return result?.key === key ? result.value : null;
}
