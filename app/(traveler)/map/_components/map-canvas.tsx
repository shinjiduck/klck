"use client";

// UX-02 Hue Map – phần bản đồ (react-map-gl + Mapbox).
// FR-F8-03 / AC-F8.1-03: gộp cụm bằng supercluster; bấm cụm thì zoom vào, bộ lọc giữ nguyên.
// AC-F8.1-02: báo vùng nhìn cho trang cha sau khi ngừng kéo/zoom 400 ms.
// AC-F8.1-06: nút phóng to, thu nhỏ, "Vị trí của tôi"; chỉ xin quyền vị trí khi bấm nút.
// AC-F8.1-05: ghim khách sạn và homestay có biểu tượng khác nhau.
// UX-06: vẽ tuyến các điểm trong một ngày của lịch (ghim đánh số + đường đi).

import "mapbox-gl/dist/mapbox-gl.css";

import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Marker, Source, type MapRef } from "react-map-gl/mapbox";
import Supercluster from "supercluster";
import { LocateFixed, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { KIND_BG, KindIcon, placeKind } from "@/components/layer-icon";
import { HUE_DEFAULT_ZOOM, type Bounds } from "@/lib/places";
import type { LatLng, Place } from "@/lib/types";

/** Thời gian chờ sau khi ngừng kéo/zoom (AC-F8.1-02 yêu cầu 300–500 ms). */
export const VIEWPORT_DEBOUNCE_MS = 400;

/** Chừa chỗ cho thanh tìm kiếm/chip (trên), ngăn kéo thu gọn (dưới) và nút zoom (phải). */
const VIEW_PADDING = { top: 150, bottom: 200, left: 30, right: 60 };

type PointProps = { placeId: string };

export type MapView = { lng: number; lat: number; zoom: number };

/** Lịch một ngày vẽ trên bản đồ (UX-06). */
export type ItineraryOverlay = {
  /** Đổi khi chọn ngày khác hoặc lịch đổi điểm → bản đồ canh lại khung cho vừa tuyến. */
  key: string;
  stops: { placeId: string; name: string; lat: number; lng: number; order: number; problem: boolean }[];
  /** [lng, lat][] */
  line: [number, number][];
  /** true = đường thẳng nối các điểm (chưa lấy được tuyến đường thật). */
  lineIsEstimate: boolean;
};

export type MapCanvasProps = {
  token: string;
  /** Tập kết quả hiện tại – cùng một mảng với danh sách ở ngăn kéo. */
  places: Place[];
  selectedId: string | null;
  userLocation: LatLng | null;
  /** Tăng giá trị để đưa bản đồ về khung nhìn toàn Huế. */
  resetViewKey: number;
  /** Khung bao mọi địa điểm đã xuất bản – khung mặc định và nút "Xem toàn Huế". */
  homeBounds: Bounds;
  /** Khung nhìn ban đầu (giữ lại vị trí đang xem khi bản đồ được dựng lại); null = dùng homeBounds. */
  initialView: MapView | null;
  onViewChange: (view: MapView) => void;
  onViewportChange: (bounds: Bounds) => void;
  onSelect: (placeId: string) => void;
  onUserLocation: (p: LatLng) => void;
  onError: () => void;
  itinerary: ItineraryOverlay | null;
};

export default function MapCanvas({
  token,
  places,
  selectedId,
  userLocation,
  resetViewKey,
  homeBounds,
  initialView,
  onViewChange,
  onViewportChange,
  onSelect,
  onUserLocation,
  onError,
  itinerary,
}: MapCanvasProps) {
  const mapRef = useRef<MapRef>(null);
  const loadedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomRef = useRef(initialView?.zoom ?? HUE_DEFAULT_ZOOM);
  // Zoom làm tròn: chỉ tính lại cụm khi đổi bậc zoom.
  const [zoom, setZoom] = useState(Math.round(zoomRef.current));
  const homeBox: [[number, number], [number, number]] = [
    [homeBounds.west, homeBounds.south],
    [homeBounds.east, homeBounds.north],
  ];
  // Chỉ render Marker sau khi bản đồ hiện tại tải xong, để Marker không bao giờ gắn vào
  // một bản đồ chưa sẵn sàng hoặc đã hủy (xem chú thích mapMountKey ở hue-map.tsx).
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => () => clearTimeout(timerRef.current ?? undefined), []);

  // Chỉ bay về toàn Huế khi resetViewKey đổi sau khi đã mount (không chạy lúc dựng lại bản đồ).
  const resetKeyRef = useRef(resetViewKey);
  useEffect(() => {
    if (resetKeyRef.current === resetViewKey) return;
    resetKeyRef.current = resetViewKey;
    moveCamera((m) => m.fitBounds(homeBox, { padding: VIEW_PADDING }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetViewKey]);

  // Canh khung bản đồ vừa với tuyến khi chọn ngày (chừa chỗ cho thanh trên và ngăn kéo dưới).
  const itineraryKey = itinerary?.key;
  useEffect(() => {
    if (!mapReady || !itinerary || itinerary.stops.length === 0) return;
    const lngs = itinerary.stops.map((s) => s.lng);
    const lats = itinerary.stops.map((s) => s.lat);
    moveCamera((m) =>
      m.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: VIEW_PADDING, maxZoom: 15, duration: 800 },
      ),
    );
    // Chỉ canh lại khi đổi ngày/đổi điểm, không canh lại khi tuyến đường thật vừa tải về.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itineraryKey, mapReady]);

  const index = useMemo(() => {
    const sc = new Supercluster<PointProps>({ radius: 56, maxZoom: 16 });
    sc.load(
      places.map((p) => ({
        type: "Feature" as const,
        properties: { placeId: p.id },
        geometry: { type: "Point" as const, coordinates: [p.location.lng, p.location.lat] },
      })),
    );
    return sc;
  }, [places]);

  // Cụm tính theo mức zoom hiện tại nhưng chỉ trên tập kết quả, nên ghim luôn khớp danh sách.
  const clusters = useMemo(() => index.getClusters([-180, -85, 180, 85], Math.round(zoom)), [index, zoom]);
  const byId = useMemo(() => new globalThis.Map(places.map((p) => [p.id, p])), [places]);

  function emitBounds() {
    const b = mapRef.current?.getBounds();
    if (!b) return;
    onViewportChange({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
  }

  function scheduleEmit() {
    clearTimeout(timerRef.current ?? undefined);
    timerRef.current = setTimeout(emitBounds, VIEWPORT_DEBOUNCE_MS);
  }

  /**
   * Di chuyển camera bằng code. Khi trình duyệt bật "giảm chuyển động", Mapbox nhảy thẳng tới vị trí
   * mới và sự kiện moveend không tới được onMoveEnd → danh sách không cập nhật. Vì vậy nếu sau lệnh
   * bản đồ đã đứng yên thì tự báo vùng nhìn (vẫn qua debounce như AC-F8.1-02).
   */
  function moveCamera(fn: (m: MapRef) => void) {
    const m = mapRef.current;
    if (!m) return;
    fn(m);
    if (!m.isMoving()) {
      const c = m.getCenter();
      onViewChange({ lng: c.lng, lat: c.lat, zoom: m.getZoom() });
      zoomRef.current = m.getZoom();
      setZoom(Math.round(m.getZoom()));
      scheduleEmit();
    }
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      toast.error("Trình duyệt không hỗ trợ lấy vị trí.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onUserLocation(p);
        moveCamera((m) => m.flyTo({ center: [p.lng, p.lat], zoom: Math.max(zoomRef.current, 14) }));
      },
      () => toast.error("Không lấy được vị trí của bạn. Hãy kiểm tra quyền truy cập vị trí."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    // Đẩy logo + attribution Mapbox lên trên ngăn kéo thu gọn (h-44) để luôn nhìn thấy (điều khoản Mapbox).
    <div className="absolute inset-0 [&_.mapboxgl-ctrl-bottom-left]:bottom-44! [&_.mapboxgl-ctrl-bottom-right]:bottom-44!">
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={
          initialView
            ? { longitude: initialView.lng, latitude: initialView.lat, zoom: initialView.zoom }
            : { bounds: homeBox, fitBoundsOptions: { padding: VIEW_PADDING } }
        }
        mapStyle="mapbox://styles/mapbox/streets-v12"
        language="vi"
        worldview="VN"
        style={{ width: "100%", height: "100%" }}
        onLoad={() => {
          loadedRef.current = true;
          setMapReady(true);
          emitBounds();
        }}
        onError={(e) => {
          console.error("Lỗi bản đồ", e.error);
          // Chỉ coi là lỗi bản đồ khi chưa tải được lần nào (vd. token sai, mất mạng).
          if (!loadedRef.current) onError();
        }}
        onZoom={(e) => {
          zoomRef.current = e.viewState.zoom;
          setZoom(Math.round(e.viewState.zoom));
        }}
        onMoveEnd={(e) => {
          onViewChange({ lng: e.viewState.longitude, lat: e.viewState.latitude, zoom: e.viewState.zoom });
          scheduleEmit();
        }}
      >
        {mapReady && clusters.map((c) => {
          const [lng, lat] = c.geometry.coordinates;
          if ("cluster" in c.properties && c.properties.cluster) {
            const { cluster_id: clusterId, point_count: count } = c.properties;
            return (
              <Marker key={`c-${clusterId}`} longitude={lng} latitude={lat} anchor="center">
                <button
                  type="button"
                  aria-label={`Cụm ${count} địa điểm, bấm để phóng to`}
                  onClick={(e) => {
                    e.stopPropagation();
                    const z = Math.min(index.getClusterExpansionZoom(clusterId), 17);
                    moveCamera((m) => m.flyTo({ center: [lng, lat], zoom: z }));
                  }}
                  className="flex size-10 items-center justify-center rounded-full border-4 border-white/70 bg-primary text-sm font-semibold text-primary-foreground shadow-lg"
                >
                  {count}
                </button>
              </Marker>
            );
          }
          const place = byId.get((c.properties as PointProps).placeId);
          if (!place) return null;
          const kind = placeKind(place);
          const selected = place.id === selectedId;
          return (
            <Marker key={place.id} longitude={lng} latitude={lat} anchor="bottom" style={{ zIndex: selected ? 2 : 1 }}>
              <button
                type="button"
                aria-label={place.name}
                title={place.name}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(place.id);
                }}
                className={cn(
                  "flex origin-bottom flex-col items-center transition-transform",
                  selected && "scale-125",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border-2 border-white text-white shadow-md",
                    KIND_BG[kind],
                  )}
                >
                  <KindIcon kind={kind} />
                </span>
                <span className={cn("-mt-1 size-2.5 rotate-45 border-r-2 border-b-2 border-white", KIND_BG[kind])} />
              </button>
            </Marker>
          );
        })}

        {mapReady && itinerary && itinerary.line.length > 1 && (
          <Source
            id="itinerary"
            type="geojson"
            data={{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: itinerary.line } }}
          >
            <Layer
              id="itinerary-casing"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": "#ffffff", "line-width": 7 }}
            />
            <Layer
              id="itinerary-line"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": "#2563eb",
                "line-width": 4,
                ...(itinerary.lineIsEstimate ? { "line-dasharray": [1.5, 1.5] } : {}),
              }}
            />
          </Source>
        )}

        {mapReady &&
          itinerary?.stops.map((s) => (
            <Marker key={`stop-${s.order}-${s.placeId}`} longitude={s.lng} latitude={s.lat} anchor="center" style={{ zIndex: 3 }}>
              <button
                type="button"
                aria-label={`Điểm ${s.order} trong lịch: ${s.name}`}
                title={s.name}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(s.placeId);
                }}
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-md",
                  s.problem ? "bg-destructive" : "bg-blue-600",
                )}
              >
                {s.order}
              </button>
            </Marker>
          ))}

        {mapReady && userLocation && (
          <Marker longitude={userLocation.lng} latitude={userLocation.lat} anchor="center">
            <span
              aria-label="Vị trí của bạn"
              className="block size-4 rounded-full border-2 border-white bg-blue-600 shadow-[0_0_0_6px_rgb(37_99_235/0.25)]"
            />
          </Marker>
        )}
      </Map>

      <div className="absolute top-1/2 right-3 z-10 flex -translate-y-1/2 flex-col gap-2">
        <div className="flex flex-col overflow-hidden rounded-lg border bg-background shadow-md">
          <MapButton label="Phóng to" onClick={() => moveCamera((m) => m.zoomIn())}>
            <Plus />
          </MapButton>
          <span className="h-px bg-border" />
          <MapButton label="Thu nhỏ" onClick={() => moveCamera((m) => m.zoomOut())}>
            <Minus />
          </MapButton>
        </div>
        <div className="overflow-hidden rounded-lg border bg-background shadow-md">
          <MapButton label="Vị trí của tôi" onClick={locate}>
            <LocateFixed />
          </MapButton>
        </div>
      </div>
    </div>
  );
}

function MapButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-10 items-center justify-center text-foreground hover:bg-muted [&_svg]:size-5"
    >
      {children}
    </button>
  );
}
