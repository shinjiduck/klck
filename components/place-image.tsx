// Ảnh địa điểm: ảnh thật nếu có image_url, nếu chưa có thì nền chuyển màu theo lớp + họa tiết nhẹ
// (dữ liệu GĐ1 chưa có ảnh; khi nhập ảnh có giấy phép qua Admin/CSV, giao diện tự đổi sang ảnh thật).

import { cn } from "cn";
import { KindIcon, placeKind } from "@/components/layer-icon";
import type { Place } from "@/lib/types";

const GRADIENT: Record<ReturnType<typeof placeKind>, string> = {
  heritage: "from-amber-200 via-amber-100 to-orange-50 text-amber-900",
  attraction: "from-teal-200 via-cyan-100 to-sky-50 text-teal-900",
  food: "from-rose-200 via-orange-100 to-amber-50 text-rose-900",
  stay: "from-indigo-200 via-violet-100 to-fuchsia-50 text-indigo-900",
  hotel: "from-indigo-200 via-violet-100 to-fuchsia-50 text-indigo-900",
  homestay: "from-emerald-200 via-lime-100 to-amber-50 text-emerald-900",
};

export function PlaceImage({
  place,
  className,
  iconClassName,
  showLabel = false,
}: {
  place: Pick<Place, "name" | "layer" | "lodging_type" | "image_url">;
  className?: string;
  iconClassName?: string;
  /** Hiện dòng "Ảnh đang cập nhật" khi chưa có ảnh (dùng ở thẻ lớn). */
  showLabel?: boolean;
}) {
  if (place.image_url) {
    return (
      <div className={cn("relative overflow-hidden bg-muted", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={place.image_url} alt={place.name} className="absolute inset-0 size-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
      </div>
    );
  }
  const kind = placeKind(place);
  return (
    <div
      role="img"
      aria-label={`${place.name} – chưa có ảnh`}
      className={cn("relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br", GRADIENT[kind], className)}
    >
      {/* Họa tiết sóng nước / mái ngói rất nhẹ */}
      <svg aria-hidden className="absolute inset-0 size-full opacity-[0.12]" preserveAspectRatio="none" viewBox="0 0 100 40">
        <path d="M0 30 Q 12.5 24 25 30 T 50 30 T 75 30 T 100 30 V40 H0Z" fill="currentColor" />
        <path d="M0 35 Q 12.5 30 25 35 T 50 35 T 75 35 T 100 35 V40 H0Z" fill="currentColor" />
      </svg>
      <span className="relative flex size-12 items-center justify-center rounded-2xl bg-white/70 shadow-sm backdrop-blur-sm">
        <KindIcon kind={kind} className={cn("size-6", iconClassName)} />
      </span>
      {showLabel && <span className="relative mt-2 text-[11px] font-medium opacity-70">Ảnh đang cập nhật</span>}
    </div>
  );
}
