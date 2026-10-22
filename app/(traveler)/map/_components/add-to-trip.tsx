"use client";

// Thêm điểm vào lịch từ thẻ địa điểm (UC-05) + UX-05 Cảnh báo xung đột (frame "05 XUNG DOT").
// FR-F8-08; AC-F8.3-05 (hỏi ngày, gợi ý khung giờ trống hợp giờ mở cửa), AC-F8.3-02 (cảnh báo trùng
// trong ngày trước khi thêm), AC-F8.3-03 (hiện xung đột + ít nhất một cách xử lý nếu tìm được:
// đổi giờ, đổi ngày, vẫn thêm), AC-F8.3-04 (lưu xong lịch và tuyến cập nhật không tải lại trang).
// Lưu lịch: cập nhật bản nháp trên máy, đã đăng nhập thì lưu phiên bản mới lên Supabase (BR-VERSION-01).

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CalendarClock, CalendarDays, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Chip } from "@/components/chip";
import { dayLabel } from "@/components/plan-timeline";
import { Button } from "@/components/ui/button";
import { DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { fmtMin } from "@/lib/places";
import { useAuth } from "@/lib/auth";
import { replaceTripDraft } from "@/lib/trip-draft";
import { TripConflictError, commitPlan, loadLatestTrip } from "@/lib/trip-sync";
import { defaultDuration, previewInsert, suggestSlots, type InsertPreview, type Slot } from "@/lib/trip-edit";
import type { GeneratedPlan, Place, TripInput } from "@/lib/types";

export type TripContext = { input: TripInput; plan: GeneratedPlan };

type Props = {
  place: Place;
  trip: TripContext;
  places: Place[];
  onBack: () => void;
  onDone: (dayNo: number) => void;
};

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

export function AddToTrip({ place, trip, places, onBack, onDone }: Props) {
  const router = useRouter();
  const auth = useAuth();
  const byId = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  const { plan, input } = trip;

  const slotsByDay = useMemo(
    () => new Map(plan.days.map((d) => [d.day_no, suggestSlots(d, place, byId)])),
    [plan, place, byId],
  );
  const firstDayWithSlot = plan.days.find((d) => (slotsByDay.get(d.day_no) ?? []).length > 0)?.day_no ?? 1;

  const [dayNo, setDayNo] = useState(firstDayWithSlot);
  const slots = slotsByDay.get(dayNo) ?? [];
  const [choice, setChoice] = useState<{ kind: "slot"; slot: Slot } | { kind: "custom"; time: string } | null>(
    slots[0] ? { kind: "slot", slot: slots[0] } : null,
  );
  const [preview, setPreview] = useState<{ dayNo: number; start: number; result: InsertPreview } | null>(null);

  const day = plan.days.find((d) => d.day_no === dayNo)!;
  const existing = day.items.find((i) => i.place_id === place.id);

  function pickDay(d: number) {
    setDayNo(d);
    const s = slotsByDay.get(d)?.[0];
    setChoice(s ? { kind: "slot", slot: s } : null);
  }

  function save(result: InsertPreview, d: number, start: number) {
    // Cập nhật ngay trên máy (AC-F8.3-04) rồi lưu phiên bản mới lên tài khoản ở nền.
    commitPlan(result.plan, auth.status === "signed_in" ? auth.user.id : null).catch((e) => {
      if (e instanceof TripConflictError) {
        toast.error("Lịch đã được sửa ở thiết bị khác", {
          description: "Thay đổi vừa rồi chưa được lưu lên tài khoản.",
          action: { label: "Tải bản mới nhất", onClick: () => reloadFromServer() },
        });
      } else {
        console.error(e);
        toast.error("Đã thêm trên máy nhưng chưa lưu được lên tài khoản.");
      }
    });
    toast.success(`Đã thêm ${place.name} vào ngày ${d} lúc ${fmtMin(start)}`, {
      action: { label: "Xem lịch", onClick: () => router.push("/trip") },
    });
    onDone(d);
  }

  async function reloadFromServer() {
    if (auth.status !== "signed_in") return;
    const remote = await loadLatestTrip(auth.user.id, places);
    if (remote) replaceTripDraft(remote);
  }

  /** Kiểm tra trước; không có xung đột thì lưu luôn, có thì mở màn UX-05. */
  function tryAdd(d: number, start: number) {
    const result = previewInsert(plan, input, byId, place, d, start);
    if (result.conflicts.length === 0 && !result.duplicateInDay) save(result, d, start);
    else setPreview({ dayNo: d, start, result });
  }

  const startFromChoice =
    choice?.kind === "slot" ? choice.slot.start_min : choice?.kind === "custom" && choice.time ? toMin(choice.time) : null;

  if (preview) {
    return (
      <ConflictView
        place={place}
        preview={preview}
        slotsByDay={slotsByDay}
        planDays={plan.days}
        onPick={tryAdd}
        onForce={() => save(preview.result, preview.dayNo, preview.start)}
        onBack={() => setPreview(null)}
      />
    );
  }

  return (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-3">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Quay lại thẻ
        </button>
        <div>
          <DrawerTitle className="text-lg font-semibold">Thêm vào lịch</DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground">
            {place.name} · khoảng {defaultDuration(place)} phút · {plan.title}
          </DrawerDescription>
        </div>

        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <CalendarDays className="size-4" aria-hidden />
            Ngày nào?
          </h3>
          <div className="flex flex-wrap gap-2">
            {plan.days.map((d) => (
              <Chip key={d.day_no} active={d.day_no === dayNo} onClick={() => pickDay(d.day_no)}>
                {dayLabel(d)}
              </Chip>
            ))}
          </div>
        </section>

        {existing && (
          <p className="flex gap-1.5 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
            {place.name} đã có trong ngày {dayNo} lúc {fmtMin(existing.start_min)}.
          </p>
        )}

        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Clock className="size-4" aria-hidden />
            Khung giờ gợi ý
          </h3>
          {slots.length === 0 && (
            <p className="mb-2 text-xs text-muted-foreground">
              Không còn khung trống hợp giờ mở cửa trong ngày này. Bạn có thể chọn ngày khác hoặc tự nhập giờ.
            </p>
          )}
          <div role="radiogroup" className="space-y-2">
            {slots.map((s) => {
              const on = choice?.kind === "slot" && choice.slot.start_min === s.start_min;
              return (
                <button
                  key={s.start_min}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setChoice({ kind: "slot", slot: s })}
                  className={cn(
                    "w-full rounded-lg border p-2.5 text-left text-sm",
                    on ? "border-primary ring-1 ring-primary" : "hover:bg-muted",
                  )}
                >
                  {s.label}
                </button>
              );
            })}
            <label
              className={cn(
                "flex items-center gap-2 rounded-lg border p-2.5 text-sm",
                choice?.kind === "custom" && "border-primary ring-1 ring-primary",
              )}
            >
              <input
                type="radio"
                className="sr-only"
                checked={choice?.kind === "custom"}
                onChange={() => setChoice({ kind: "custom", time: "" })}
              />
              <span className="shrink-0">Giờ khác</span>
              <Input
                type="time"
                step={300}
                aria-label="Giờ bắt đầu"
                className="h-8"
                value={choice?.kind === "custom" ? choice.time : ""}
                onFocus={() => choice?.kind !== "custom" && setChoice({ kind: "custom", time: "" })}
                onChange={(e) => setChoice({ kind: "custom", time: e.target.value })}
              />
            </label>
          </div>
        </section>
      </div>

      <div className="shrink-0 border-t p-4">
        <Button
          size="lg"
          className="w-full"
          disabled={startFromChoice == null}
          onClick={() => startFromChoice != null && tryAdd(dayNo, startFromChoice)}
        >
          <CalendarClock data-icon="inline-start" />
          {startFromChoice != null ? `Thêm vào ngày ${dayNo} lúc ${fmtMin(startFromChoice)}` : "Chọn khung giờ"}
        </Button>
      </div>
    </>
  );
}

/** UX-05 Cảnh báo xung đột. */
function ConflictView({
  place,
  preview,
  slotsByDay,
  planDays,
  onPick,
  onForce,
  onBack,
}: {
  place: Place;
  preview: { dayNo: number; start: number; result: InsertPreview };
  slotsByDay: Map<number, Slot[]>;
  planDays: GeneratedPlan["days"];
  onPick: (dayNo: number, start: number) => void;
  onForce: () => void;
  onBack: () => void;
}) {
  const { dayNo, start, result } = preview;
  const sameDay = (slotsByDay.get(dayNo) ?? []).filter((s) => s.start_min !== start)[0];
  const otherDays = planDays
    .filter((d) => d.day_no !== dayNo)
    .map((d) => ({ day: d, slot: slotsByDay.get(d.day_no)?.[0] }))
    .filter((x): x is { day: (typeof planDays)[number]; slot: Slot } => Boolean(x.slot));
  const hasFix = Boolean(sameDay) || otherDays.length > 0;

  return (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-3">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Chọn giờ khác
        </button>

        <div className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-5 text-destructive" aria-hidden />
          </span>
          <div>
            <DrawerTitle className="text-lg font-semibold">
              {result.conflicts.length > 0 ? "Lịch bị xung đột" : "Điểm đã có trong ngày"}
            </DrawerTitle>
            <DrawerDescription className="text-sm text-muted-foreground">
              {place.name} · ngày {dayNo} lúc {fmtMin(start)}
            </DrawerDescription>
          </div>
        </div>

        <ul className="space-y-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {result.duplicateInDay && <li>• {place.name} đã có trong ngày {dayNo}. Thêm nữa sẽ bị trùng.</li>}
          {result.conflicts.map((c, i) => (
            <li key={i}>• {c.message}</li>
          ))}
        </ul>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Cách xử lý</h3>
          {sameDay && (
            <Fix
              title={`Đổi giờ: ${sameDay.label}`}
              hint="Cùng ngày, hợp giờ mở cửa và đủ thời gian di chuyển"
              onClick={() => onPick(dayNo, sameDay.start_min)}
            />
          )}
          {otherDays.map(({ day, slot }) => (
            <Fix
              key={day.day_no}
              title={`Đổi ngày: ${dayLabel(day)}, ${fmtMin(slot.start_min)}–${fmtMin(slot.end_min)}`}
              hint={slot.label.split(" · ")[1]}
              onClick={() => onPick(day.day_no, slot.start_min)}
            />
          ))}
          {!hasFix && (
            <p className="text-xs text-muted-foreground">
              Không tìm được khung giờ trống phù hợp ở các ngày trong lịch.
            </p>
          )}
        </section>
      </div>

      <div className="flex shrink-0 gap-2 border-t p-4">
        <Button variant="outline" size="lg" className="flex-1" onClick={onBack}>
          Hủy
        </Button>
        <Button variant="destructive" size="lg" className="flex-1" onClick={onForce}>
          Vẫn thêm
        </Button>
      </div>
    </>
  );
}

function Fix({ title, hint, onClick }: { title: string; hint?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full rounded-lg border p-3 text-left hover:bg-muted">
      <span className="block text-sm font-medium">{title}</span>
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </button>
  );
}
