// MapProvider Adapter (SRS – Kiến trúc và tích hợp): mọi lời gọi tới nhà cung cấp bản đồ đi qua
// giao diện chung để đổi Mapbox ↔ Goong/VIETMAP mà không sửa nghiệp vụ.
// GĐ1 mới cài `route` (vẽ tuyến trong ngày trên Hue Map – FR-F8-09 phần GĐ2 được làm sớm).
// Thời gian di chuyển dùng cho Constraint Engine vẫn là ước tính GĐ1 (lib/places.estimateTravel),
// nên lịch có khả thi hay không không phụ thuộc vào dịch vụ ngoài.

import type { LatLng } from "@/lib/types";

export type TravelMode = "driving" | "walking";

export type RouteResult = {
  /** GeoJSON LineString [lng, lat][] */
  coordinates: [number, number][];
  distance_m: number;
  duration_s: number;
};

export interface MapProvider {
  readonly name: string;
  /** null khi nhà cung cấp lỗi – giao diện tự dùng đường thẳng dự phòng. */
  route(points: LatLng[], mode: TravelMode): Promise<RouteResult | null>;
  // Các hàm còn lại theo SRS, làm ở GĐ2: geocode, reverseGeocode, matrix, getMapConfig, normalizePlace.
}

class MapboxProvider implements MapProvider {
  readonly name = "mapbox";
  private cache = new Map<string, Promise<RouteResult | null>>();

  constructor(private token: string) {}

  route(points: LatLng[], mode: TravelMode): Promise<RouteResult | null> {
    if (points.length < 2) return Promise.resolve(null);
    // Directions API nhận tối đa 25 điểm.
    const coords = points
      .slice(0, 25)
      .map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`)
      .join(";");
    const key = `${mode}:${coords}`;
    const hit = this.cache.get(key);
    if (hit) return hit;

    const url =
      `https://api.mapbox.com/directions/v5/mapbox/${mode}/${coords}` +
      `?geometries=geojson&overview=full&language=vi&access_token=${encodeURIComponent(this.token)}`;
    const req = fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Directions ${res.status}`);
        const json = (await res.json()) as {
          routes?: { geometry: { coordinates: [number, number][] }; distance: number; duration: number }[];
        };
        const r = json.routes?.[0];
        return r ? { coordinates: r.geometry.coordinates, distance_m: r.distance, duration_s: r.duration } : null;
      })
      .catch((err) => {
        console.warn("Không lấy được tuyến từ Mapbox, dùng đường thẳng.", err);
        this.cache.delete(key); // cho phép thử lại lần sau
        return null;
      });
    this.cache.set(key, req);
    return req;
  }
}

let instance: MapProvider | null = null;

/** Trả null khi chưa cấu hình token. */
export function getMapProvider(): MapProvider | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  instance ??= new MapboxProvider(token);
  return instance;
}
