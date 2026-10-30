"use client";

// UX-02 Hue Map (frame "02 HUEMAP") + mở UX-03 Thẻ địa điểm.
// UC-02, UC-03. FR-F8-01 → 07, FR-F8-09.
// - Một tập kết quả duy nhất `results` cấp cho cả ghim và ngăn kéo (FR-F8-04, AC-F8.1-02).
// - Bộ lọc lưu trên URL (FR-F8-06, AC-F8.2-01); "Xóa bộ lọc" về mặc định (AC-F8.2-02).
// - Chưa có NEXT_PUBLIC_MAPBOX_TOKEN hoặc bản đồ lỗi: hiện khung xám, danh sách vẫn chạy
//   (UC-02 ngoại lệ "Dịch vụ bản đồ lỗi").
// - UX-06 / UC-04 bước 6: vẽ lịch của một ngày (ghim đánh số + tuyến), chọn ngày qua ?day=N.

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MapPinOff, Navigation, Route } from "lucide-react";
import { cn } from "cn";
import { placeKind } from "@/components/layer-icon";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { getMapProvider, type RouteResult } from "@/lib/map/provider";
import { takePendingAction } from "@/lib/pending-action";
import {
  DEFAULT_FILTERS,
  HUE_CENTER,
  LAYERS,
  countActiveFilters,
  directionsUrl,
  estimateTravel,
  filtersFromSearchParams,
  filtersToSearchParams,
  getPlaceMatch,
  inBounds,
  isDefaultFilters,
  matchesFilters,
  nowInHue,
  todayInHue,
  type Bounds,
  type MapFilters,
} from "@/lib/places";
import { preferenceFromDraft, useTripDraft } from "@/lib/trip-draft";
import type { Category, LatLng, Place } from "@/lib/types";
import { FilterSheet } from "./filter-sheet";
import type { ItineraryLeg, ItineraryOverlay, MapView } from "./map-canvas";
import { MapTopBar } from "./map-top-bar";
import { PlaceCard } from "./place-card";
import { PlaceListSheet } from "./place-list-sheet";

const MapCanvas = dynamic(() => import("./map-canvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-muted" />,
});

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

type Props = {
  places: Place[];
  categories: Category[];
};

export function HueMap({ places, categories }: Props) {
  const searchParams = useSearchParams();
  const filters = useMemo(() => filtersFromSearchParams(new URLSearchParams(searchParams)), [searchParams]);

  // Ô tìm kiếm giữ giá trị riêng để gõ tiếng Việt (IME) không bị giật, rồi mới ghi lên URL.
  const [query, setQuery] = useState(filters.q);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [mapError, setMapError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [resetViewKey, setResetViewKey] = useState(0);
  const [now, setNow] = useState(() => new Date());

  // Sở thích khai ở UX-01. Chưa khai → không khẳng định "Hợp với bạn" (AC-F8.4-03).
  const draft = useTripDraft();
  const preference = useMemo(() => preferenceFromDraft(draft), [draft]);

  const mapAvailable = MAPBOX_TOKEN !== "" && !mapError;

  // Trạng thái mở cửa đổi theo giờ: làm mới mỗi phút.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Cache Components giữ trang khi chuyển tab bằng <Activity>: khi trang bị ẩn thì effect bị dọn,
  // react-map-gl hủy bản đồ nhưng vẫn giữ khung DOM cũ; lúc quay lại nó không dựng lại được
  // (lỗi "reading 'appendChild'", bản đồ mất ghim). Vì vậy mỗi lần bị ẩn ta đổi key để MapCanvas
  // được dựng mới hoàn toàn khi quay lại, và nhớ khung nhìn cuối để người dùng không bị mất vị trí.
  const [mapMountKey, setMapMountKey] = useState(0);
  const [lastView, setLastView] = useState<MapView | null>(null);

  // Khung bao mọi địa điểm đã xuất bản: mở bản đồ là thấy đủ các ghim (SRS – Thứ tự xây dựng, tuần 6).
  const homeBounds = useMemo<Bounds>(() => {
    const lats = places.map((p) => p.location.lat);
    const lngs = places.map((p) => p.location.lng);
    return lats.length
      ? { south: Math.min(...lats), north: Math.max(...lats), west: Math.min(...lngs), east: Math.max(...lngs) }
      : { south: HUE_CENTER.lat - 0.05, north: HUE_CENTER.lat + 0.05, west: HUE_CENTER.lng - 0.05, east: HUE_CENTER.lng + 0.05 };
  }, [places]);

  // Khi trang bị ẩn: đóng thẻ và bảng lọc, chuẩn bị dựng lại bản đồ.
  useLayoutEffect(
    () => () => {
      setSelectedId(null);
      setFilterOpen(false);
      setBounds(null);
      setMapMountKey((k) => k + 1);
    },
    [],
  );

  // Ghi bộ lọc + ngày lịch đang xem lên URL bằng history API của trình duyệt:
  // Next.js đồng bộ với useSearchParams mà không tải lại trang.
  const writeUrl = useCallback((next: MapFilters, day: number | null) => {
    const sp = filtersToSearchParams(next);
    if (day != null) sp.set("day", String(day));
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, []);

  const setFilters = useCallback(
    (next: MapFilters) => {
      const day = new URLSearchParams(window.location.search).get("day");
      writeUrl(next, day ? Number(day) : null);
    },
    [writeUrl],
  );

  // ---------- ?place=<id>: mở thẻ địa điểm (link chia sẻ, quay lại sau khi đăng nhập – AC-F8.3-01) ----------
  const auth = useAuth();
  const placeParam = searchParams.get("place");
  const [autoAddFor, setAutoAddFor] = useState<string | null>(null);
  const handledPlace = useRef<string | null>(null);
  useEffect(() => {
    if (!placeParam || handledPlace.current === placeParam || auth.status === "loading") return;
    if (!places.some((p) => p.id === placeParam)) return;
    handledPlace.current = placeParam;
    // Chạy đúng một lần cho mỗi ?place, sau khi biết trạng thái đăng nhập; phải lấy hành động chờ ra khỏi
    // localStorage nên không làm trong lúc render được (StrictMode gọi render 2 lần sẽ lấy mất hành động).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(placeParam);
    if (auth.status === "signed_in" && takePendingAction("add_place")?.place_id === placeParam) {
      setAutoAddFor(placeParam);
    }
    // Bỏ ?place khỏi URL để tải lại trang không mở lại thẻ.
    const sp = new URLSearchParams(window.location.search);
    writeUrl(filtersFromSearchParams(sp), sp.get("day") ? Number(sp.get("day")) : null);
  }, [placeParam, auth.status, places, writeUrl]);

  // ---------- Lịch trên bản đồ (UX-06) ----------
  const plan = draft?.selected ?? null;
  const dayParam = Number(searchParams.get("day"));
  const viewDay = plan?.days.find((d) => d.day_no === dayParam) ?? null;

  // AC-F8.2-06: điểm trước đó trong lịch – ngày đang xem tuyến, hoặc hôm nay nếu hôm nay có trong lịch.
  const prevStop = useMemo(() => {
    const today = todayInHue(now);
    const day = viewDay ?? plan?.days.find((d) => d.date === today) ?? null;
    if (!day || day.items.length === 0) return null;
    const isToday = day.date === today;
    const mins = nowInHue(now).minutes;
    const item = isToday
      ? ([...day.items].filter((i) => i.start_min <= mins).pop() ?? day.items[0])
      : day.items[day.items.length - 1];
    const p = places.find((x) => x.id === item.place_id);
    if (!p) return null;
    return {
      name: p.name,
      label: isToday ? `Từ ${p.name} (điểm vừa qua trong lịch hôm nay)` : `Từ ${p.name} (điểm cuối ngày ${day.day_no})`,
      location: p.location,
    };
  }, [viewDay, plan, places, now]);
  const setViewDay = (day: number | null) =>
    writeUrl(filtersFromSearchParams(new URLSearchParams(window.location.search)), day);

  const stops = useMemo(() => {
    if (!viewDay || !plan) return [];
    const byId = new Map(places.map((p) => [p.id, p]));
    return viewDay.items.flatMap((it, i) => {
      const p = byId.get(it.place_id);
      if (!p) return [];
      const problem = plan.issues.some(
        (x) => x.severity === "error" && x.place_id === p.id && (x.day_no == null || x.day_no === viewDay.day_no),
      );
      return [
        { placeId: p.id, name: p.name, lat: p.location.lat, lng: p.location.lng, order: i + 1, problem, kind: placeKind(p) },
      ];
    });
  }, [viewDay, plan, places]);
  const stopsKey = stops.map((s) => `${s.lng},${s.lat}`).join(";");

  // Tuyến đường thật qua MapProvider, lấy riêng từng chặng để xem lần lượt (chặng đi – về trùng đường
  // không đè lên nhau). Chặng chưa có (đang tải / lỗi) thì nối thẳng và ghi "ước tính".
  const [legRoutes, setLegRoutes] = useState<Record<string, RouteResult>>({});
  useEffect(() => {
    const provider = getMapProvider();
    if (!provider || stops.length < 2) return;
    let cancelled = false;
    stops.slice(1).forEach((to, i) => {
      const from = stops[i];
      provider.route([from, to], "driving").then((r) => {
        if (!cancelled && r) setLegRoutes((m) => ({ ...m, [legKey(from, to)]: r }));
      });
    });
    return () => {
      cancelled = true;
    };
    // stopsKey đại diện cho stops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopsKey]);

  const legs: ItineraryLeg[] = stops.slice(1).map((to, i) => {
    const from = stops[i];
    const r = legRoutes[legKey(from, to)];
    if (r) {
      return {
        from,
        to,
        line: r.coordinates,
        isEstimate: false,
        km: r.distance_m / 1000,
        minutes: Math.max(1, Math.round(r.duration_s / 60)),
      };
    }
    const est = estimateTravel(from, to);
    return { from, to, line: [[from.lng, from.lat], [to.lng, to.lat]], isEstimate: true, ...est };
  });

  // Chặng đang xem (null = toàn tuyến); gắn với stopsKey nên đổi ngày/sửa lịch thì tự về toàn tuyến.
  const [legView, setLegView] = useState<{ key: string; index: number } | null>(null);
  const activeLeg = legView?.key === stopsKey && legView.index < legs.length ? legView.index : null;
  const setActiveLeg = (index: number | null) => setLegView(index == null ? null : { key: stopsKey, index });

  const itinerary: ItineraryOverlay | null = viewDay
    ? { key: `${viewDay.day_no}:${stopsKey}`, stops, legs, activeLeg }
    : null;

  // Ghi từ khóa lên URL sau 300 ms ngừng gõ.
  useEffect(() => {
    if (query === filters.q) return;
    const id = setTimeout(() => setFilters({ ...filters, q: query }), 300);
    return () => clearTimeout(id);
  }, [query, filters, setFilters]);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const getCategory = useCallback((id: string) => categoryById.get(id), [categoryById]);
  const getMatch = useCallback((p: Place) => getPlaceMatch(p, preference), [preference]);

  // Tập kết quả duy nhất cho ghim + danh sách.
  const results = useMemo(
    () =>
      places.filter(
        (p) =>
          matchesFilters(p, filters, categoryById.get(p.primary_category_id), now) &&
          (!mapAvailable || bounds == null || inBounds(p.location, bounds)),
      ),
    [places, filters, categoryById, now, mapAvailable, bounds],
  );

  const loading = mapAvailable && bounds == null;

  function resetFilters() {
    setQuery("");
    setFilters(DEFAULT_FILTERS);
  }

  const emptyHints = [
    filters.q && "từ khóa khác",
    countActiveFilters(filters) > 0 && "bỏ bớt bộ lọc",
    filters.layers.length < LAYERS.length && "bật thêm lớp",
    mapAvailable && "kéo hoặc thu nhỏ bản đồ",
  ].filter((x): x is string => Boolean(x));

  const selected = selectedId ? (places.find((p) => p.id === selectedId) ?? null) : null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {mapAvailable ? (
        <MapCanvas
          key={mapMountKey}
          token={MAPBOX_TOKEN}
          initialView={lastView}
          homeBounds={homeBounds}
          onViewChange={setLastView}
          places={results}
          selectedId={selectedId ?? hoverId}
          userLocation={userLocation}
          resetViewKey={resetViewKey}
          onViewportChange={setBounds}
          onSelect={setSelectedId}
          onUserLocation={setUserLocation}
          onError={() => setMapError(true)}
          itinerary={itinerary}
        />
      ) : (
        <MapPlaceholder error={MAPBOX_TOKEN !== "" && mapError} />
      )}

      {plan && mapAvailable && (
        <DayPicker days={plan.days.map((d) => d.day_no)} value={viewDay?.day_no ?? null} onChange={setViewDay} />
      )}
      {mapAvailable && viewDay && legs.length > 0 && (
        <LegBar legs={legs} active={activeLeg} onChange={setActiveLeg} onSelectStop={setSelectedId} />
      )}

      <MapTopBar
        filters={filters}
        query={query}
        onQueryChange={setQuery}
        onFiltersChange={setFilters}
        onOpenFilters={() => setFilterOpen(true)}
      />

      <PlaceListSheet
        places={results}
        loading={loading}
        viewportBased={mapAvailable}
        now={now}
        getCategory={getCategory}
        getMatch={getMatch}
        onSelect={setSelectedId}
        emptyHints={emptyHints}
        canReset={!isDefaultFilters({ ...filters, q: query })}
        onReset={resetFilters}
        onResetView={mapAvailable ? () => setResetViewKey((k) => k + 1) : undefined}
        onHover={setHoverId}
      />

      <FilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        resultCount={results.length}
        onFiltersChange={setFilters}
        onReset={resetFilters}
      />

      <PlaceCard
        place={selected}
        category={selected ? categoryById.get(selected.primary_category_id) : undefined}
        match={selected ? getMatch(selected) : null}
        userLocation={userLocation}
        now={now}
        onClose={() => {
          setSelectedId(null);
          setAutoAddFor(null);
        }}
        startAdding={autoAddFor != null && autoAddFor === selectedId}
        trip={draft && plan ? { input: draft.input, plan } : null}
        prevStop={prevStop}
        places={places}
        onAdded={(dayNo) => {
          setSelectedId(null);
          if (mapAvailable) setViewDay(dayNo); // AC-F8.3-04: hiện ngay tuyến đã cập nhật
        }}
      />
    </div>
  );
}

const legKey = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => `${a.lng},${a.lat};${b.lng},${b.lat}`;

const fmtKm = (km: number) => km.toLocaleString("vi-VN", { maximumFractionDigits: 1 });

/**
 * Xem tuyến theo từng chặng: ‹ › chuyển chặng, chặng đang xem tô đậm có mũi tên hướng đi,
 * kèm quãng đường, thời gian và nút chỉ đường Google Maps (xe máy) cho riêng chặng đó.
 */
function LegBar({
  legs,
  active,
  onChange,
  onSelectStop,
}: {
  legs: ItineraryLeg[];
  active: number | null;
  onChange: (i: number | null) => void;
  onSelectStop: (placeId: string) => void;
}) {
  const leg = active == null ? null : legs[active];
  const totalKm = legs.reduce((s, l) => s + l.km, 0);
  const totalMin = legs.reduce((s, l) => s + l.minutes, 0);
  const anyEstimate = legs.some((l) => l.isEstimate);
  const navBtn =
    "flex size-9 shrink-0 items-center justify-center rounded-full border bg-background text-foreground hover:bg-muted disabled:opacity-40";
  return (
    <div className="absolute right-3 bottom-[15.5rem] left-3 z-10 rounded-2xl border bg-background/95 p-2.5 shadow-lg backdrop-blur lg:right-auto lg:bottom-24 lg:left-[396px] lg:w-[360px]">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={navBtn}
          aria-label="Chặng trước"
          disabled={active == null}
          onClick={() => onChange(active === 0 ? null : (active ?? 0) - 1)}
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1 text-center" aria-live="polite">
          {leg ? (
            <>
              <p className="text-[11px] font-medium text-muted-foreground">
                Chặng {active! + 1}/{legs.length}
              </p>
              {/* Hai dòng để tên dài không bị cắt mất điểm đến. */}
              <button
                type="button"
                className="block w-full truncate text-xs text-muted-foreground hover:underline"
                onClick={() => onSelectStop(leg.from.placeId)}
              >
                Từ {leg.from.order}. {leg.from.name}
              </button>
              <button
                type="button"
                className="block w-full truncate text-sm font-semibold hover:underline"
                onClick={() => onSelectStop(leg.to.placeId)}
              >
                Đến {leg.to.order}. {leg.to.name}
              </button>
              <p className="text-xs text-muted-foreground">
                {fmtKm(leg.km)} km · khoảng {leg.minutes} phút {leg.isEstimate ? "(ước tính)" : "(theo đường thực tế)"}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">Toàn tuyến · {legs.length} chặng</p>
              <p className="text-xs text-muted-foreground">
                {fmtKm(totalKm)} km · khoảng {totalMin} phút di chuyển{anyEstimate ? " (ước tính)" : ""} · bấm › để đi từng chặng
              </p>
            </>
          )}
        </div>
        <button
          type="button"
          className={navBtn}
          aria-label={active === legs.length - 1 ? "Về toàn tuyến" : "Chặng tiếp theo"}
          onClick={() => onChange(active == null ? 0 : active === legs.length - 1 ? null : active + 1)}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      {leg && (
        <a
          href={directionsUrl(leg.to, { origin: leg.from })}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ size: "sm" }), "mt-2 w-full")}
        >
          <Navigation data-icon="inline-start" />
          Chỉ đường chặng này (xe máy)
        </a>
      )}
    </div>
  );
}

/** Chọn ngày của lịch để vẽ tuyến; "Ẩn" để chỉ xem ghim khám phá. */
function DayPicker({
  days,
  value,
  onChange,
}: {
  days: number[];
  value: number | null;
  onChange: (d: number | null) => void;
}) {
  const btn = (active: boolean) =>
    cn(
      "h-7 rounded-full px-2.5 text-xs font-medium transition-colors",
      active ? "bg-blue-600 text-white" : "text-foreground hover:bg-muted",
    );
  return (
    <div
      role="group"
      aria-label="Xem lịch trên bản đồ"
      className="absolute bottom-[13rem] left-3 z-10 flex items-center gap-0.5 rounded-full border bg-background p-0.5 shadow-md lg:bottom-10 lg:left-[396px]"
    >
      <span className="flex items-center gap-1 pr-1 pl-2 text-xs text-muted-foreground">
        <Route className="size-3.5" aria-hidden />
        Lịch
      </span>
      <button type="button" aria-pressed={value == null} className={btn(value == null)} onClick={() => onChange(null)}>
        Ẩn
      </button>
      {days.map((d) => (
        <button key={d} type="button" aria-pressed={value === d} className={btn(value === d)} onClick={() => onChange(d)}>
          N{d}
        </button>
      ))}
    </div>
  );
}

function MapPlaceholder({ error }: { error: boolean }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-200 px-8 pb-40 text-center text-neutral-600">
      <MapPinOff className="size-8" aria-hidden />
      <p className="font-medium">{error ? "Không tải được bản đồ" : "Chưa cấu hình bản đồ"}</p>
      <p className="text-xs">
        {error
          ? "Bạn vẫn xem được danh sách địa điểm bên dưới."
          : "Thêm NEXT_PUBLIC_MAPBOX_TOKEN vào .env.local rồi chạy lại. Danh sách bên dưới vẫn dùng được."}
      </p>
    </div>
  );
}
