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

/** Chừa chỗ cho thanh tìm kiếm/chip (trên), ngăn kéo thu gọn (dưới) và nút zoom (phải).
 *  Máy tính: danh sách là cột trái 380px nên chừa bên trái thay vì bên dưới. */
const viewPadding = () =>
  typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
    ? { top: 120, bottom: 40, left: 420, right: 70 }
    : { top: 150, bottom: 200, left: 30, right: 60 };

type PointProps = { placeId: string };

export type MapView = { lng: number; lat: number; zoom: number };

/** Lịch một ngày vẽ trên bản đồ (UX-06). */
export type ItineraryOverlay = {
  /** Đổi khi chọn ngày khác hoặc lịch đổi điểm → bản đồ canh lại khung cho vừa tuyến. */
  key: string;
  stops: ItineraryStop[];
  /** Chặng i nối stops[i] → stops[i + 1]. */
  legs: ItineraryLeg[];
  /** Chặng đang xem (null = toàn tuyến): tô đậm + mũi tên hướng đi, các chặng khác mờ. */
  activeLeg: number | null;
};

export type ItineraryStop = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  order: number;
  problem: boolean;
  kind: ReturnType<typeof placeKind>;
};

export type ItineraryLeg = {
  from: ItineraryStop;
  to: ItineraryStop;
  /** [lng, lat][] */
  line: [number, number][];
  /** true = đường thẳng nối hai điểm (chưa lấy được tuyến đường thật). */
  isEstimate: boolean;
  km: number;
  minutes: number;
};

/** Khi xem tuyến: chừa thêm chỗ dưới cho thanh chặng (LegBar). */
const routePadding = () => {
  const p = viewPadding();
  return { ...p, bottom: p.bottom + (window.matchMedia("(min-width: 1024px)").matches ? 110 : 210) };
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
    moveCamera((m) => m.fitBounds(homeBox, { padding: viewPadding() }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetViewKey]);

  // Canh khung bản đồ vừa với tuyến khi chọn ngày (chừa chỗ cho thanh trên và ngăn kéo dưới).
  // Xem một chặng: canh khung vừa hai điểm của chặng đó.
  const itineraryKey = itinerary?.key;
  const activeLeg = itinerary?.activeLeg ?? null;
  const activeLegReal = activeLeg != null && itinerary?.legs[activeLeg]?.isEstimate === false;
  useEffect(() => {
    if (!mapReady || !itinerary || itinerary.stops.length === 0) return;
    const leg = activeLeg == null ? null : itinerary.legs[activeLeg];
    // Chặng: canh theo cả đường đi (đường thật có thể vòng ra ngoài hai điểm đầu–cuối).
    const pts: [number, number][] = leg ? leg.line : itinerary.stops.map((s) => [s.lng, s.lat]);
    const lngs = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    moveCamera((m) =>
      m.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: routePadding(), maxZoom: leg ? 16 : 15, duration: 800 },
      ),
    );
    // Canh lại khi đổi ngày/đổi điểm/đổi chặng, và khi đường thật của chặng đang xem vừa tải về.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itineraryKey, activeLeg, activeLegReal, mapReady]);

  const activeLegStops =
    itinerary && activeLeg != null && itinerary.legs[activeLeg]
      ? [itinerary.legs[activeLeg].from.order, itinerary.legs[activeLeg].to.order]
      : null;

  // Mỗi chặng một feature; state: 2 = đang xem, 1 = toàn tuyến, 0 = chặng khác khi đang xem một chặng.
  const legFeatures = useMemo(() => {
    if (!itinerary) return null;
    return {
      type: "FeatureCollection" as const,
      features: itinerary.legs.map((l, i) => ({
        type: "Feature" as const,
        properties: {
          state: itinerary.activeLeg == null ? 1 : i === itinerary.activeLeg ? 2 : 0,
          estimate: l.isEstimate ? 1 : 0,
        },
        geometry: { type: "LineString" as const, coordinates: l.line },
      })),
    };
  }, [itinerary]);

  // Khi xem tuyến: điểm trong lịch chỉ vẽ một lần (ghim đánh số bên dưới), không gộp vào cụm.
  const stopIds = useMemo(() => new Set(itinerary?.stops.map((s) => s.placeId)), [itinerary?.stops]);
  const index = useMemo(() => {
    const sc = new Supercluster<PointProps>({ radius: 56, maxZoom: 16 });
    sc.load(
      places.filter((p) => !stopIds.has(p.id)).map((p) => ({
        type: "Feature" as const,
        properties: { placeId: p.id },
        geometry: { type: "Point" as const, coordinates: [p.location.lng, p.location.lat] },
      })),
    );
    return sc;
  }, [places, stopIds]);

  // Cụm tính theo mức zoom hiện tại nhưng chỉ trên tập kết quả, nên ghim luôn khớp danh sách.
  const clusters = useMemo(() => index.getClusters([-180, -85, 180, 85], Math.round(zoom)), [index, zoom]);
  const byId = useMemo(() => new globalThis.Map(places.map((p) => [p.id, p])), [places]);

  /**
   * Vùng nhìn = khung bản đồ người dùng thật sự thấy. Không dùng getBounds(): sau fitBounds có padding,
   * Mapbox GL v3 giữ padding và getBounds() chỉ trả vùng bên trong padding → điểm ở mép bị loại khỏi
   * danh sách dù vẫn thấy ghim. Máy tính: bỏ phần bị cột danh sách 380px che (AC-F8.1-02: ghim = danh sách).
   */
  function emitBounds() {
    const m = mapRef.current?.getMap();
    if (!m) return;
    const el = m.getContainer();
    const left = window.matchMedia("(min-width: 1024px)").matches ? Math.min(380, el.clientWidth) : 0;
    const sw = m.unproject([left, el.clientHeight]);
    const ne = m.unproject([el.clientWidth, 0]);
    onViewportChange({ west: sw.lng, south: sw.lat, east: ne.lng, north: ne.lat });
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
    <div className="absolute inset-0 [&_.mapboxgl-ctrl-bottom-left]:bottom-44! [&_.mapboxgl-ctrl-bottom-right]:bottom-44! lg:[&_.mapboxgl-ctrl-bottom-left]:bottom-0! lg:[&_.mapboxgl-ctrl-bottom-left]:left-[380px]! lg:[&_.mapboxgl-ctrl-bottom-right]:bottom-0!">
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={
          initialView
            ? { longitude: initialView.lng, latitude: initialView.lat, zoom: initialView.zoom }
            : { bounds: homeBox, fitBoundsOptions: { padding: viewPadding() } }
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
              <Marker key={`c-${clusterId}`} longitude={lng} latitude={lat} anchor="center" style={{ opacity: itinerary ? 0.55 : 1 }}>
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
            <Marker
              key={place.id}
              longitude={lng}
              latitude={lat}
              anchor="bottom"
              style={{ zIndex: selected ? 2 : 1, opacity: itinerary && !selected ? 0.55 : 1 }}
            >
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

        {mapReady && legFeatures && legFeatures.features.length > 0 && (
          <Source id="itinerary" type="geojson" data={legFeatures}>
            {/* Chặng mờ vẽ trước, chặng đang xem vẽ sau cùng để nằm trên khi trùng đường. */}
            <Layer
              id="itinerary-casing"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round", "line-sort-key": ["get", "state"] }}
              paint={{
                "line-color": "#ffffff",
                "line-width": ["match", ["get", "state"], 2, 10, 1, 7, 5],
                "line-opacity": ["match", ["get", "state"], 0, 0.5, 1],
              }}
            />
            <Layer
              id="itinerary-line"
              type="line"
              filter={["==", ["get", "estimate"], 0]}
              layout={{ "line-cap": "round", "line-join": "round", "line-sort-key": ["get", "state"] }}
              paint={{
                "line-color": ["match", ["get", "state"], 0, "#94a3b8", "#2563eb"],
                "line-width": ["match", ["get", "state"], 2, 6, 1, 4, 3],
                "line-opacity": ["match", ["get", "state"], 0, 0.6, 1],
              }}
            />
            {/* Chặng chưa có đường thật: nét đứt (dasharray không dùng được biểu thức theo feature). */}
            <Layer
              id="itinerary-line-estimate"
              type="line"
              filter={["==", ["get", "estimate"], 1]}
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": ["match", ["get", "state"], 0, "#94a3b8", "#2563eb"],
                "line-width": ["match", ["get", "state"], 2, 5, 3],
                "line-dasharray": [1.5, 1.5],
              }}
            />
            {/* Mũi tên hướng đi dọc tuyến: chỉ trên chặng đang xem (hoặc mọi chặng khi xem toàn tuyến). */}
            <Layer
              id="itinerary-arrows"
              type="symbol"
              filter={[">", ["get", "state"], 0]}
              layout={{
                "symbol-placement": "line",
                "symbol-spacing": 60,
                "text-field": ">",
                "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
                "text-size": ["match", ["get", "state"], 2, 30, 22],
                "text-keep-upright": false,
                "text-rotation-alignment": "map",
                "text-allow-overlap": true,
                "text-ignore-placement": true,
              }}
              paint={{ "text-color": "#ffffff", "text-halo-color": "#1d4ed8", "text-halo-width": 1.5 }}
            />
          </Source>
        )}

        {mapReady &&
          itinerary?.stops.map((s) => (
            <Marker
              key={`stop-${s.order}-${s.placeId}`}
              longitude={s.lng}
              latitude={s.lat}
              anchor="bottom"
              style={{ zIndex: 3, opacity: activeLegStops && !activeLegStops.includes(s.order) ? 0.45 : 1 }}
            >
              <button
                type="button"
                aria-label={`Điểm ${s.order} trong lịch: ${s.name}`}
                title={s.name}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(s.placeId);
                }}
                className={cn(
                  "relative flex origin-bottom flex-col items-center transition-transform",
                  s.placeId === selectedId && "scale-125",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full border-2 border-white text-white shadow-md",
                    KIND_BG[s.kind],
                  )}
                >
                  <KindIcon kind={s.kind} />
                </span>
                <span className={cn("-mt-1 size-2.5 rotate-45 border-r-2 border-b-2 border-white", KIND_BG[s.kind])} />
                <span
                  className={cn(
                    "absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow",
                    s.problem ? "bg-destructive" : "bg-blue-600",
                  )}
                >
                  {s.order}
                </span>
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
