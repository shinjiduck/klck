"use client";

// UX-02 – Ngăn kéo dưới chứa danh sách địa điểm.
// FR-F8-04 / AC-F8.1-04: trên điện thoại danh sách là ngăn kéo dưới, luôn khớp với ghim.
// AC-F8.2-04: không có kết quả → gợi ý nới bộ lọc.
// AC-F8.4-06: dòng có nhãn ngắn khi địa điểm phù hợp sở thích.

import { useRef, useState } from "react";
import { ChevronUp, SearchX } from "lucide-react";
import { cn } from "cn";
import { KIND_SOFT, KindIcon, placeKind } from "@/components/layer-icon";
import { Button } from "@/components/ui/button";
import { LAYER_LABEL, getOpenStatus, getPriceText, type OpenState } from "@/lib/places";
import type { Category, Place, PlaceMatch } from "@/lib/types";

type Props = {
  places: Place[];
  loading: boolean;
  /** Ngữ cảnh: có bản đồ (lọc theo vùng nhìn) hay không. */
  viewportBased: boolean;
  now: Date;
  getCategory: (id: string) => Category | undefined;
  getMatch: (p: Place) => PlaceMatch | null;
  onSelect: (id: string) => void;
  /** Gợi ý cho trạng thái rỗng. */
  emptyHints: string[];
  canReset: boolean;
  onReset: () => void;
  onResetView?: () => void;
  /** Máy tính: rê chuột vào dòng thì ghim tương ứng nổi lên (Bố cục Hue Map). */
  onHover?: (id: string | null) => void;
};

export const OPEN_TONE: Record<OpenState, string> = {
  open: "text-emerald-700",
  closed: "text-rose-700",
  unknown: "text-muted-foreground",
};

export function PlaceListSheet({
  places,
  loading,
  viewportBased,
  now,
  getCategory,
  getMatch,
  onSelect,
  emptyHints,
  canReset,
  onReset,
  onResetView,
  onHover,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const dragStartY = useRef<number | null>(null);

  const title = loading
    ? "Đang tải địa điểm…"
    : `${places.length} địa điểm${viewportBased ? " trong vùng bản đồ" : ""}`;

  return (
    <section
      aria-label="Danh sách địa điểm"
      className={cn(
        "absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl border-t bg-background shadow-[0_-4px_16px_rgb(0_0_0/0.08)] transition-[height] duration-300 ease-out",
        expanded ? "h-[65%]" : "h-44",
        // AC-F8.1-04: máy tính → cột bên trái cao hết màn hình
        "lg:top-0 lg:right-auto lg:h-full! lg:w-[380px] lg:rounded-none lg:border-t-0 lg:border-r lg:shadow-none",
      )}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? "Thu gọn danh sách" : "Mở rộng danh sách"}
        onClick={() => setExpanded((v) => !v)}
        onPointerDown={(e) => (dragStartY.current = e.clientY)}
        onPointerUp={(e) => {
          if (dragStartY.current == null) return;
          const dy = e.clientY - dragStartY.current;
          dragStartY.current = null;
          if (dy < -24) {
            e.preventDefault();
            setExpanded(true);
          } else if (dy > 24) {
            e.preventDefault();
            setExpanded(false);
          }
        }}
        className="flex shrink-0 touch-none flex-col items-center gap-1.5 px-4 pt-2 pb-2"
      >
        <span className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        <span className="flex w-full items-center justify-between">
          <span className="text-sm font-semibold" aria-live="polite">
            {title}
          </span>
          <ChevronUp
            className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-180")}
            aria-hidden
          />
        </span>
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
        {loading ? (
          <ListSkeleton />
        ) : places.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-3 text-center">
            <SearchX className="size-6 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Không có địa điểm phù hợp</p>
            {emptyHints.length > 0 && (
              <p className="text-xs text-muted-foreground">Thử {emptyHints.join(", ")}.</p>
            )}
            <div className="flex gap-2">
              {canReset && (
                <Button size="sm" onClick={onReset}>
                  Xóa bộ lọc
                </Button>
              )}
              {onResetView && (
                <Button size="sm" variant="outline" onClick={onResetView}>
                  Xem toàn Huế
                </Button>
              )}
            </div>
          </div>
        ) : (
          <ul className="space-y-1">
            {places.map((p) => {
              const kind = placeKind(p);
              const status = getOpenStatus(p, now);
              const match = getMatch(p);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(p.id)}
                    onMouseEnter={() => onHover?.(p.id)}
                    onMouseLeave={() => onHover?.(null)}
                    className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted"
                  >
                    <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg", KIND_SOFT[kind])}>
                      <KindIcon kind={kind} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {getCategory(p.primary_category_id)?.name ?? LAYER_LABEL[p.layer]} ·{" "}
                        <span className={OPEN_TONE[status.state]}>{status.label}</span>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{getPriceText(p)}</span>
                      {match && (
                        <span className="mt-1 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800">
                          Hợp sở thích · {LAYER_LABEL[p.layer]}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function ListSkeleton() {
  return (
    <ul className="space-y-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex gap-3 px-2 py-2">
          <span className="size-9 animate-pulse rounded-lg bg-muted" />
          <span className="flex-1 space-y-1.5">
            <span className="block h-3.5 w-2/3 animate-pulse rounded bg-muted" />
            <span className="block h-3 w-1/2 animate-pulse rounded bg-muted" />
          </span>
        </li>
      ))}
    </ul>
  );
}
