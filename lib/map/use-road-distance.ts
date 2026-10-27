"use client";

// Khoảng cách + thời gian theo đường thật (MapProvider) cho thẻ địa điểm.
// Chưa tải xong hoặc nhà cung cấp lỗi → dùng ước tính GĐ1 (lib/places.estimateTravel), real = false.
// Chỉ dùng để hiển thị; Constraint Engine vẫn dùng ước tính để lịch không phụ thuộc dịch vụ ngoài.

import { useEffect, useState } from "react";
import { getMapProvider } from "@/lib/map/provider";
import { estimateTravel } from "@/lib/places";
import type { LatLng } from "@/lib/types";

export type RoadDistance = { km: number; minutes: number; real: boolean };

// Làm tròn ~10 m để vị trí GPS dao động nhẹ không gọi lại API.
const keyOf = (from: LatLng, to: LatLng) =>
  [from.lat, from.lng, to.lat, to.lng].map((n) => n.toFixed(4)).join(",");

export function useRoadDistance(from: LatLng | null, to: LatLng): RoadDistance | null {
  const key = from ? keyOf(from, to) : null;
  const [real, setReal] = useState<{ key: string; km: number; minutes: number } | null>(null);

  useEffect(() => {
    const provider = getMapProvider();
    if (!from || !key || !provider) return;
    let cancelled = false;
    provider.route([from, to], "driving").then((r) => {
      if (!cancelled && r) {
        setReal({ key, km: r.distance_m / 1000, minutes: Math.max(1, Math.round(r.duration_s / 60)) });
      }
    });
    return () => {
      cancelled = true;
    };
    // key đại diện cho from/to
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!from) return null;
  if (real?.key === key) return { km: real.km, minutes: real.minutes, real: true };
  return { ...estimateTravel(from, to), real: false };
}

const fmtKm = (km: number) => km.toLocaleString("vi-VN", { maximumFractionDigits: 1 });

/** "2,3 km · khoảng 8 phút (theo đường thực tế)" hoặc "... (ước tính)". */
export function formatRoadDistance(d: RoadDistance): string {
  return `${fmtKm(d.km)} km · khoảng ${d.minutes} phút ${d.real ? "(theo đường thực tế)" : "đi xe máy (ước tính)"}`;
}
