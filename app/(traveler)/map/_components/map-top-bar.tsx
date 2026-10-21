"use client";

// UX-02 – Thanh trên: ô tìm kiếm, chip lớp cuộn ngang, nút Bộ lọc.
// FR-F8-01, FR-F8-02 (bật/tắt nhiều lớp), AC-F8.1-05 (bật Lưu trú → hiện bộ lọc loại hình).

import { Search, SlidersHorizontal, X } from "lucide-react";
import { Chip } from "@/components/chip";
import { KindIcon } from "@/components/layer-icon";
import { Input } from "@/components/ui/input";
import { LAYER_LABEL, LAYERS, LODGING_LABEL, countActiveFilters, type MapFilters } from "@/lib/places";
import type { LodgingType, PlaceLayer } from "@/lib/types";

type Props = {
  filters: MapFilters;
  query: string;
  onQueryChange: (q: string) => void;
  onFiltersChange: (f: MapFilters) => void;
  onOpenFilters: () => void;
};

export function MapTopBar({ filters, query, onQueryChange, onFiltersChange, onOpenFilters }: Props) {
  const allOn = filters.layers.length === LAYERS.length;
  const activeCount = countActiveFilters(filters);

  function toggleLayer(layer: PlaceLayer) {
    let next: PlaceLayer[];
    if (allOn) next = [layer]; // Đang "Tất cả": bấm một lớp thì chỉ xem lớp đó.
    else if (filters.layers.includes(layer)) next = filters.layers.filter((l) => l !== layer);
    else next = [...filters.layers, layer];
    if (next.length === 0) next = [...LAYERS]; // Tắt hết thì quay về "Tất cả".
    onFiltersChange({ ...filters, layers: LAYERS.filter((l) => next.includes(l)) });
  }

  function toggleLodging(t: LodgingType) {
    const lodging = filters.lodging.includes(t) ? filters.lodging.filter((x) => x !== t) : [...filters.lodging, t];
    onFiltersChange({ ...filters, lodging });
  }

  const showLodgingRow = filters.layers.includes("stay") && !allOn;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 space-y-2 bg-gradient-to-b from-background/90 via-background/60 to-transparent px-3 pt-3 pb-4">
      <div className="pointer-events-auto flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Tìm địa điểm ở Huế"
            aria-label="Tìm địa điểm"
            className="h-10 rounded-full bg-background pr-9 pl-9 shadow-sm [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              aria-label="Xóa từ khóa"
              onClick={() => onQueryChange("")}
              className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenFilters}
          className="relative flex h-10 shrink-0 items-center gap-1.5 rounded-full border bg-background px-3 text-sm font-medium shadow-sm hover:bg-muted"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Bộ lọc
          {activeCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      <div
        role="group"
        aria-label="Lớp bản đồ"
        className="pointer-events-auto -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]"
      >
        <Chip active={allOn} onClick={() => onFiltersChange({ ...filters, layers: [...LAYERS] })}>
          Tất cả
        </Chip>
        {LAYERS.map((layer) => (
          <Chip key={layer} active={!allOn && filters.layers.includes(layer)} onClick={() => toggleLayer(layer)}>
            <KindIcon kind={layer} />
            {LAYER_LABEL[layer]}
          </Chip>
        ))}
      </div>

      {showLodgingRow && (
        <div role="group" aria-label="Loại hình lưu trú" className="pointer-events-auto flex gap-2">
          {(["hotel", "homestay"] as const).map((t) => (
            <Chip
              key={t}
              active={filters.lodging.includes(t)}
              onClick={() => toggleLodging(t)}
              className="h-7 text-xs"
            >
              <KindIcon kind={t} className="size-3.5" />
              {LODGING_LABEL[t]}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
