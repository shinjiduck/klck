"use client";

// FR-ADM-02 / UC-14 bước 3: chọn tọa độ bằng cách chấm trên bản đồ nhỏ (hoặc kéo ghim).

import "mapbox-gl/dist/mapbox-gl.css";

import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import { HUE_CENTER } from "@/lib/places";

export default function CoordPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  if (!token) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
        Chưa cấu hình bản đồ – nhập vĩ độ, kinh độ bằng tay.
      </div>
    );
  }
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  return (
    <div className="h-64 overflow-hidden rounded-lg border">
      <Map
        mapboxAccessToken={token}
        initialViewState={{ latitude: lat ?? HUE_CENTER.lat, longitude: lng ?? HUE_CENTER.lng, zoom: lat ? 15 : 12 }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        language="vi"
        worldview="VN"
        cursor="crosshair"
        style={{ width: "100%", height: "100%" }}
        onClick={(e) => onChange(round(e.lngLat.lat), round(e.lngLat.lng))}
      >
        <NavigationControl position="top-right" showCompass={false} />
        {lat != null && lng != null && (
          <Marker
            latitude={lat}
            longitude={lng}
            anchor="bottom"
            draggable
            onDragEnd={(e) => onChange(round(e.lngLat.lat), round(e.lngLat.lng))}
            color="#dc2626"
          />
        )}
      </Map>
    </div>
  );
}
