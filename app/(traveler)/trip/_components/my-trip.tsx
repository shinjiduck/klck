"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, Map as MapIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Chip } from "@/components/chip";
import { PlanTimeline, dayLabel } from "@/components/plan-timeline";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatVnd } from "@/lib/places";
import { updateSelectedPlan, useTripDraft } from "@/lib/trip-draft";
import { removeItem } from "@/lib/trip-edit";
import type { Place } from "@/lib/types";

// UX-06 Lịch ngày (frame "06 LICH NGAY"): lịch theo ngày, xóa điểm, mở tuyến trên Hue Map.
// FR-F8-08, AC-F8.3-04 (sửa lịch cập nhật ngay không tải lại trang).

export function MyTrip({ places }: { places: Place[] }) {
  const draft = useTripDraft();
  const placesById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  const [dayNo, setDayNo] = useState(1);

  if (draft === undefined) return null;

  const plan = draft?.selected;
  if (!plan) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <CalendarDays className="size-7 text-muted-foreground" aria-hidden />
        </div>
        <h1 className="text-lg font-semibold">Chưa có lịch trình</h1>
        <p className="text-sm text-muted-foreground">
          {draft
            ? "Bạn đã khai sở thích nhưng chưa chọn phương án."
            : "Khai sở thích để HueTrip gợi ý 3 phương án lịch trình cho bạn."}
        </p>
        <Link href={draft ? "/plans" : "/onboarding"} className={buttonVariants({ size: "lg" })}>
          {draft ? "Xem 3 phương án" : "Lên lịch trình"}
        </Link>
      </div>
    );
  }

  const day = plan.days.find((d) => d.day_no === dayNo) ?? plan.days[0];
  const errors = plan.issues.filter((i) => i.severity === "error");

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-4 px-4 pt-5 pb-6">
        <header className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-semibold">{plan.title}</h1>
            {plan.feasible ? (
              <Badge className="bg-emerald-600 text-white">
                <CheckCircle2 />
                Khả thi
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-900">
                <AlertTriangle />
                Còn {errors.length} vấn đề
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {plan.summary} · ~{formatVnd(plan.est_cost_per_person_vnd)}/người (ước tính)
          </p>
          <div className="flex gap-2 pt-1">
            <Link href="/plans" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Đổi phương án
            </Link>
            <Link href="/onboarding" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Sửa sở thích
            </Link>
          </div>
        </header>

        <div role="tablist" aria-label="Chọn ngày" className="-mx-4 flex gap-2 overflow-x-auto px-4">
          {plan.days.map((d) => (
            <Chip key={d.day_no} role="tab" aria-selected={d.day_no === day.day_no} active={d.day_no === day.day_no} onClick={() => setDayNo(d.day_no)}>
              {dayLabel(d)}
            </Chip>
          ))}
        </div>

        <Link href={`/map?day=${day.day_no}`} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
          <MapIcon data-icon="inline-start" />
          Xem tuyến ngày {day.day_no} trên bản đồ
        </Link>

        {errors.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            {errors.map((e, i) => (
              <li key={i}>• {e.message}</li>
            ))}
          </ul>
        )}

        <PlanTimeline
          day={day}
          placesById={placesById}
          issues={plan.issues}
          onRemove={(index) => {
            const name = placesById.get(day.items[index]?.place_id)?.name ?? "Điểm";
            updateSelectedPlan(removeItem(plan, draft!.input, placesById, day.day_no, index));
            toast.success(`Đã xóa ${name} khỏi ngày ${day.day_no}`);
          }}
        />

        <p className="text-xs text-muted-foreground">
          Bản nháp lưu trên trình duyệt này. Thêm điểm: mở thẻ địa điểm trên Bản đồ → &ldquo;Thêm vào lịch&rdquo;.
        </p>
      </div>
    </div>
  );
}
