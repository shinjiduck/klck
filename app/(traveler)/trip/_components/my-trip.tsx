"use client";

// UX-06 Lịch ngày (frame "06 LICH NGAY"): lịch theo ngày, xóa điểm, mở tuyến trên Hue Map.
// FR-F8-08, AC-F8.3-04 (sửa lịch cập nhật ngay không tải lại trang).
// Ma trận quyền: thêm/xóa điểm trong lịch cần đăng nhập; mỗi lần sửa lưu một phiên bản mới (BR-VERSION-01).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  CloudOff,
  Map as MapIcon,
  Navigation,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { AccountButton } from "@/components/account-button";
import { Chip } from "@/components/chip";
import { PlanTimeline, dayLabel } from "@/components/plan-timeline";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { needsLogin, useAuth } from "@/lib/auth";
import { dayDirectionsUrls, formatVnd } from "@/lib/places";
import { replaceTripDraft, useTripDraft } from "@/lib/trip-draft";
import { removeItem } from "@/lib/trip-edit";
import { TripConflictError, commitPlan, loadLatestTrip } from "@/lib/trip-sync";
import type { Place } from "@/lib/types";
import { HeroBanner } from "@/components/hero-banner";

const HERO_BTN = "bg-white/15 text-primary-foreground ring-1 ring-white/25 hover:bg-white/25";

export function MyTrip({ places }: { places: Place[] }) {
  const auth = useAuth();
  const pathname = usePathname();
  const draft = useTripDraft();
  const placesById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  const [dayNo, setDayNo] = useState(1);

  if (draft === undefined) return null;

  const plan = draft?.selected;
  if (!plan) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <AccountButton className="absolute top-4 right-4" />
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
          <CalendarDays className="size-8 text-primary" aria-hidden />
        </div>
        <h1 className="text-2xl font-semibold">Chưa có lịch trình</h1>
        <p className="text-sm text-muted-foreground">
          {draft
            ? "Bạn đã khai sở thích nhưng chưa chọn phương án."
            : "Khai sở thích để HueTrip gợi ý 3 phương án lịch trình cho bạn."}
        </p>
        <Link href={draft ? "/plans" : "/onboarding"} className={cn(buttonVariants({ size: "lg" }), "h-12 rounded-full px-6")}>
          {draft ? "Xem 3 phương án" : "Lên lịch trình"}
        </Link>
      </div>
    );
  }

  const day = plan.days.find((d) => d.day_no === dayNo) ?? plan.days[0];
  const errors = plan.issues.filter((i) => i.severity === "error");
  const guest = needsLogin(auth);
  const stay = draft?.input.stay_place_id ? placesById.get(draft.input.stay_place_id) : undefined;
  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;
  const dayLinks = dayDirectionsUrls(
    stay?.location ?? null,
    day.items.flatMap((it) => placesById.get(it.place_id)?.location ?? []),
  );

  async function reloadFromServer() {
    if (auth.status !== "signed_in") return;
    const remote = await loadLatestTrip(auth.user.id, places);
    if (remote) replaceTripDraft(remote);
  }

  function remove(index: number) {
    const name = placesById.get(day.items[index]?.place_id)?.name ?? "Điểm";
    const next = removeItem(plan!, draft!.input, placesById, day.day_no, index);
    commitPlan(next, auth.status === "signed_in" ? auth.user.id : null).catch((e) => {
      if (e instanceof TripConflictError) {
        toast.error("Lịch đã được sửa ở thiết bị khác", {
          description: "Thay đổi vừa rồi chưa được lưu lên tài khoản.",
          action: { label: "Tải bản mới nhất", onClick: () => void reloadFromServer() },
        });
      } else {
        console.error(e);
        toast.error("Đã xóa trên máy nhưng chưa lưu được lên tài khoản.");
      }
    });
    toast.success(`Đã xóa ${name} khỏi ngày ${day.day_no}`);
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-4 px-4 pt-5 pb-6">
        <AccountButton className="justify-end" />
        <HeroBanner eyebrow="Lịch của tôi" title={plan.title}>
          <div className="space-y-3">
            {plan.feasible ? (
              <Badge className="bg-emerald-500 text-white">
                <CheckCircle2 />
                Khả thi
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-900">
                <AlertTriangle />
                Còn {errors.length} vấn đề
              </Badge>
            )}
            <p>
              {plan.summary} · ~{formatVnd(plan.est_cost_per_person_vnd)}/người (ước tính)
              {draft?.server && ` · Phiên bản ${draft.server.version_no}`}
            </p>
            <div className="flex gap-2">
              <Link href="/plans" className={cn(buttonVariants({ size: "sm" }), HERO_BTN)}>
                Đổi phương án
              </Link>
              <Link href="/onboarding" className={cn(buttonVariants({ size: "sm" }), HERO_BTN)}>
                Sửa sở thích
              </Link>
            </div>
          </div>
        </HeroBanner>

        {guest && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="space-y-2">
              <p>Lịch này chưa được lưu vào tài khoản. Đăng nhập để lưu và thêm, xóa điểm.</p>
              <Link href={loginHref} className={buttonVariants({ size: "sm" })}>
                Đăng nhập để lưu
              </Link>
            </div>
          </div>
        )}

        <div role="tablist" aria-label="Chọn ngày" className="-mx-4 flex gap-2 overflow-x-auto px-4">
          {plan.days.map((d) => (
            <Chip
              key={d.day_no}
              role="tab"
              aria-selected={d.day_no === day.day_no}
              active={d.day_no === day.day_no}
              onClick={() => setDayNo(d.day_no)}
            >
              {dayLabel(d)}
            </Chip>
          ))}
        </div>

        <Link href={`/map?day=${day.day_no}`} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
          <MapIcon data-icon="inline-start" />
          Xem tuyến ngày {day.day_no} trên bản đồ
        </Link>
        {/* Dẫn đường cả ngày theo đúng thứ tự lịch, xe máy, xuất phát từ nơi ở (chưa chọn: vị trí hiện tại). */}
        {dayLinks.length > 0 && (
          <div className="-mt-2 flex gap-2">
            {dayLinks.map((href, i) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "flex-1")}
              >
                <Navigation data-icon="inline-start" />
                {dayLinks.length > 1 ? `Dẫn đường chặng ${i + 1}` : `Dẫn đường cả ngày ${day.day_no}`}
              </a>
            ))}
          </div>
        )}

        {/* UX-07: gợi ý ăn, ở theo tuyến */}
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/trip/suggest?type=food&day=${day.day_no}`}
            className={buttonVariants({ variant: "outline" })}
          >
            <UtensilsCrossed data-icon="inline-start" />
            Gợi ý ăn uống
          </Link>
          <Link href="/trip/suggest?type=stay" className={buttonVariants({ variant: "outline" })}>
            <BedDouble data-icon="inline-start" />
            {stay ? "Đổi nơi ở" : "Gợi ý nơi ở"}
          </Link>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          Mỗi ngày xuất phát từ <b>{stay ? stay.name : "trung tâm Huế (chưa chọn nơi ở)"}</b>.
        </p>

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
          onRemove={guest ? undefined : remove}
          directions={{ origin: stay?.location ?? null }}
        />

        <p className="text-xs text-muted-foreground">
          {auth.status === "signed_in"
            ? "Đã lưu vào tài khoản. "
            : auth.status === "disabled"
              ? "Chế độ dữ liệu giả: lịch lưu trên trình duyệt này. "
              : ""}
          Thêm điểm: mở thẻ địa điểm trên Bản đồ → &ldquo;Thêm vào lịch&rdquo;.
        </p>
      </div>
    </div>
  );
}
