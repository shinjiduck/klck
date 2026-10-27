"use client";

// UX-07 Gợi ý ăn uống, lưu trú theo tuyến (frame "07 AN O"). UC-06.
// - Ăn uống (FR-F3-01, AC-F3-01): theo từng bữa của ngày; quán đang mở, hợp ngân sách, đúng chế độ ăn,
//   xếp theo độ lệch khỏi tuyến. Đổi/thêm quán đi qua Constraint Engine như "Thêm vào lịch" (UC-05).
// - Nơi ở (FR-F3-02, AC-F3-02): xếp theo tổng thời gian di chuyển của CẢ lịch; chọn xong mỗi ngày xuất phát từ đó.
// - AC-F3-03: nhãn trạng thái giá; AC-F3-04: kết quả tài trợ tách riêng, có nhãn "Tài trợ / Đối tác".
// Xem gợi ý không cần đăng nhập; áp dụng vào lịch thì cần (ma trận quyền).

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { ArrowLeft, BedDouble, Check, MapPin, Sparkles, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Chip } from "@/components/chip";
import { KindIcon } from "@/components/layer-icon";
import { dayLabel } from "@/components/plan-timeline";
import { PriceBadge } from "@/components/price-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { needsLogin, useAuth } from "@/lib/auth";
import { LODGING_LABEL, fmtMin, formatVnd } from "@/lib/places";
import {
  mealSlots,
  originLabel,
  originOf,
  suggestFood,
  suggestStay,
  type FoodSuggestion,
  type MealSlot,
  type StaySuggestion,
} from "@/lib/reco/suggest";
import { replaceTripDraft, useTripDraft } from "@/lib/trip-draft";
import { applyStay, previewInsert, removeItem } from "@/lib/trip-edit";
import { TripConflictError, commitDraft, commitPlan, loadLatestTrip } from "@/lib/trip-sync";
import type { GeneratedPlan, LodgingType, Place, TripInput } from "@/lib/types";
import { HeroBanner } from "@/components/hero-banner";
import { PlaceImage } from "@/components/place-image";

type Tab = "food" | "stay";

export function SuggestView({ places }: { places: Place[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const auth = useAuth();
  const draft = useTripDraft();
  const byId = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);

  const tab: Tab = params.get("type") === "stay" ? "stay" : "food";
  const dayParam = Number(params.get("day")) || 1;
  const lodging = (params.get("lt")?.split(",").filter(Boolean) ?? []) as LodgingType[];

  const setParams = (patch: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    router.replace(`/trip/suggest?${sp.toString()}`, { scroll: false });
  };

  if (draft === undefined) return null;
  const plan = draft?.selected;
  if (!draft || !plan) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="text-2xl font-semibold">Chưa có lịch trình</p>
        <p className="text-sm text-muted-foreground">Gợi ý ăn, ở dựa trên tuyến của lịch. Hãy chọn một phương án trước.</p>
        <Link href={draft ? "/plans" : "/onboarding"} className={buttonVariants()}>
          {draft ? "Xem 3 phương án" : "Lên lịch trình"}
        </Link>
      </div>
    );
  }

  const input = draft.input;
  const day = plan.days.find((d) => d.day_no === dayParam) ?? plan.days[0];
  const userId = auth.status === "signed_in" ? auth.user.id : null;
  const here = `/trip/suggest?${params.toString()}`;

  /** Áp dụng thay đổi vào lịch: cần đăng nhập; lưu phiên bản mới; báo khi xung đột phiên bản. */
  function guard(): boolean {
    if (needsLogin(auth)) {
      toast.info("Đăng nhập để áp dụng vào lịch");
      router.push(`/login?next=${encodeURIComponent(here)}`);
      return false;
    }
    return true;
  }

  function onSaveError(e: unknown) {
    if (e instanceof TripConflictError) {
      toast.error("Lịch đã được sửa ở thiết bị khác", {
        description: "Thay đổi vừa rồi chưa được lưu lên tài khoản.",
        action: {
          label: "Tải bản mới nhất",
          onClick: async () => {
            if (!userId) return;
            const remote = await loadLatestTrip(userId, places);
            if (remote) replaceTripDraft(remote);
          },
        },
      });
    } else {
      console.error(e);
      toast.error("Đã cập nhật trên máy nhưng chưa lưu được lên tài khoản.");
    }
  }

  function applyFood(slot: MealSlot, s: FoodSuggestion) {
    if (!guard()) return;
    const base: GeneratedPlan = slot.current ? removeItem(plan!, input, byId, slot.day_no, slot.current.index) : plan!;
    const result = previewInsert(base, input, byId, s.place, slot.day_no, s.start_min);
    const save = () => {
      commitPlan(result.plan, userId).catch(onSaveError);
      toast.success(`${slot.current ? "Đã đổi" : "Đã thêm"} ${slot.label.toLowerCase()} ngày ${slot.day_no}: ${s.place.name}`);
    };
    if (result.conflicts.length || result.duplicateInDay) {
      // UX-05: vẫn hiện xung đột và để người dùng quyết định.
      toast.warning("Đổi quán này sẽ làm lịch bị xung đột", {
        description: [
          ...(result.duplicateInDay ? [`${s.place.name} đã có trong ngày ${slot.day_no}.`] : []),
          ...result.conflicts.map((c) => c.message),
        ].join(" "),
        action: { label: "Vẫn đổi", onClick: save },
      });
      return;
    }
    save();
  }

  function chooseStay(placeId: string | null) {
    if (!guard()) return;
    const next = applyStay(plan!, input, byId, placeId);
    commitDraft(next.input, next.plan, userId).catch(onSaveError);
    toast.success(placeId ? `Đã chọn nơi ở: ${byId.get(placeId)?.name}` : "Đã bỏ chọn nơi ở");
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-4 px-4 pt-5 pb-8">
        <Link href="/trip" className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Lịch của tôi
        </Link>
        <HeroBanner eyebrow={plan.title} title="Gợi ý ăn, ở theo tuyến">
          Xuất phát mỗi ngày từ <b className="text-accent">{originLabel(input, byId)}</b>
        </HeroBanner>

        <div role="tablist" className="grid grid-cols-2 rounded-lg bg-muted p-1 text-sm font-medium">
          {(
            [
              ["food", "Ăn uống", UtensilsCrossed],
              ["stay", "Nơi ở", BedDouble],
            ] as const
          ).map(([t, label, Icon]) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setParams({ type: t })}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md py-1.5",
                tab === t ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        {tab === "food" ? (
          <FoodTab
            plan={plan}
            input={input}
            places={places}
            byId={byId}
            dayNo={day.day_no}
            onDay={(d) => setParams({ day: String(d) })}
            onApply={applyFood}
          />
        ) : (
          <StayTab
            plan={plan}
            input={input}
            places={places}
            byId={byId}
            lodging={lodging}
            onLodging={(lt) => setParams({ lt: lt.join(",") || null })}
            onChoose={chooseStay}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------

function FoodTab({
  plan,
  input,
  places,
  byId,
  dayNo,
  onDay,
  onApply,
}: {
  plan: GeneratedPlan;
  input: TripInput;
  places: Place[];
  byId: Map<string, Place>;
  dayNo: number;
  onDay: (d: number) => void;
  onApply: (slot: MealSlot, s: FoodSuggestion) => void;
}) {
  const day = plan.days.find((d) => d.day_no === dayNo) ?? plan.days[0];
  const slots = mealSlots(day, byId, originOf(input, byId));

  return (
    <section className="space-y-4">
      <div role="tablist" aria-label="Chọn ngày" className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {plan.days.map((d) => (
          <Chip key={d.day_no} active={d.day_no === day.day_no} onClick={() => onDay(d.day_no)}>
            {dayLabel(d)}
          </Chip>
        ))}
      </div>
      {input.dietary.includes("vegetarian") && (
        <p className="text-xs text-muted-foreground">Bạn đã khai ăn chay: chỉ gợi ý quán chay hoặc có món chay.</p>
      )}

      {slots.map((slot) => {
        const s = suggestFood(slot, input, day.date, places);
        const current = slot.current ? byId.get(slot.current.place_id) : undefined;
        return (
          <div key={slot.key} className="space-y-2">
            <div>
              <h2 className="text-sm font-semibold">
                {slot.label} · khoảng {fmtMin(slot.start_min)}
              </h2>
              <p className="text-xs text-muted-foreground">
                {current ? `Đang chọn: ${current.name}` : "Lịch chưa có quán cho bữa này"}
              </p>
            </div>
            {s.items.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                Không có quán nào mở cửa, hợp ngân sách và chế độ ăn trong khung giờ này.
              </p>
            ) : (
              s.items.map((x) => (
                <SuggestionCard
                  key={x.place.id}
                  place={x.place}
                  reasons={x.reasons}
                  action={current ? "Đổi sang quán này" : `Thêm vào ${slot.label.toLowerCase()}`}
                  onAction={() => onApply(slot, x)}
                />
              ))
            )}
            {s.sponsored.map((x) => (
              <SuggestionCard
                key={x.place.id}
                place={x.place}
                reasons={x.reasons}
                sponsored
                action={current ? "Đổi sang quán này" : `Thêm vào ${slot.label.toLowerCase()}`}
                onAction={() => onApply(slot, x)}
              />
            ))}
          </div>
        );
      })}
    </section>
  );
}

function StayTab({
  plan,
  input,
  places,
  byId,
  lodging,
  onLodging,
  onChoose,
}: {
  plan: GeneratedPlan;
  input: TripInput;
  places: Place[];
  byId: Map<string, Place>;
  lodging: LodgingType[];
  onLodging: (lt: LodgingType[]) => void;
  onChoose: (placeId: string | null) => void;
}) {
  const s = suggestStay(plan.days, input, places, { lodging });
  const nights = Math.max(1, plan.days.length - 1);
  const current = input.stay_place_id ? byId.get(input.stay_place_id) : undefined;
  const toggle = (t: LodgingType) => onLodging(lodging.includes(t) ? lodging.filter((x) => x !== t) : [...lodging, t]);

  const card = (x: StaySuggestion, sponsored = false) => {
    const chosen = x.place.id === input.stay_place_id;
    const stayCost = x.place.price_min_vnd != null ? x.place.price_min_vnd * nights : null;
    return (
      <SuggestionCard
        key={x.place.id}
        place={x.place}
        sponsored={sponsored}
        subtitle={x.place.lodging_type ? LODGING_LABEL[x.place.lodging_type] : undefined}
        reasons={x.reasons}
        extra={
          <>
            <p className="text-xs">
              Tổng di chuyển: <b>~{x.total_min} phút</b> ({x.per_day.map((d) => `ngày ${d.day_no}: ${d.minutes}′`).join(", ")})
            </p>
            {stayCost != null && (
              <p className="text-xs text-muted-foreground">
                Từ ~{formatVnd(stayCost)} cho {nights} đêm (giá thấp nhất, chưa gồm thuế phí)
              </p>
            )}
          </>
        }
        action={chosen ? "Đang chọn" : "Chọn làm nơi ở"}
        actionDisabled={chosen}
        onAction={() => onChoose(x.place.id)}
      />
    );
  };

  return (
    <section className="space-y-3">
      <div className="rounded-lg bg-muted/60 p-3 text-sm">
        {current ? (
          <div className="flex items-center justify-between gap-2">
            <span>
              Nơi ở hiện tại: <b>{current.name}</b>
            </span>
            <Button size="sm" variant="ghost" onClick={() => onChoose(null)}>
              Bỏ chọn
            </Button>
          </div>
        ) : (
          <span>Chưa chọn nơi ở: lịch đang tính đường đi từ trung tâm Huế.</span>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          Xếp theo tổng thời gian đi từ nơi ở tới điểm đầu và về từ điểm cuối của <b>mọi ngày</b> trong lịch.
        </p>
      </div>

      <div role="group" aria-label="Loại hình lưu trú" className="flex gap-2">
        {(["hotel", "homestay"] as const).map((t) => (
          <Chip key={t} active={lodging.includes(t)} onClick={() => toggle(t)}>
            <KindIcon kind={t} />
            {LODGING_LABEL[t]}
          </Chip>
        ))}
      </div>

      {s.items.length === 0 && s.sponsored.length === 0 && (
        <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Không có nơi ở phù hợp ngân sách và loại hình đã chọn.
        </p>
      )}
      {s.items.map((x) => card(x))}
      {s.sponsored.map((x) => card(x, true))}
    </section>
  );
}

function SuggestionCard({
  place,
  subtitle,
  reasons,
  extra,
  sponsored = false,
  action,
  actionDisabled = false,
  onAction,
}: {
  place: Place;
  subtitle?: string;
  reasons: string[];
  extra?: React.ReactNode;
  sponsored?: boolean;
  action: string;
  actionDisabled?: boolean;
  onAction: () => void;
}) {
  return (
    <article className={cn("rounded-2xl border bg-card p-3 shadow-sm", sponsored && "border-amber-300 bg-amber-50/50")}>
      {sponsored && (
        <p className="mb-2 inline-block rounded bg-amber-200 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">
          Tài trợ / Đối tác
        </p>
      )}
      <div className="flex gap-2.5">
        <PlaceImage place={place} className="size-16 shrink-0 rounded-xl" iconClassName="size-6" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[15px] leading-snug font-semibold">{place.name}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          <PriceBadge place={place} />
          <ul className="flex flex-wrap gap-1">
            {reasons.map((r) => (
              <li key={r} className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px]">
                <Sparkles className="size-3 text-emerald-600" aria-hidden />
                {r}
              </li>
            ))}
          </ul>
          {extra}
        </div>
      </div>
      <div className="mt-2.5 flex gap-2">
        <Button size="sm" className="flex-1" disabled={actionDisabled} onClick={onAction}>
          {actionDisabled && <Check data-icon="inline-start" />}
          {action}
        </Button>
        <Link
          href={`/map?place=${place.id}`}
          className={cn(buttonVariants({ size: "sm", variant: "outline" }), "flex-1")}
        >
          <MapPin data-icon="inline-start" />
          Xem trên bản đồ
        </Link>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">Nguồn: {place.source}</p>
    </article>
  );
}
