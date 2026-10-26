"use client";

// UC-01 Xem lịch mẫu. Lịch sinh bằng bộ sinh phương án + Constraint Engine trên dữ liệu đã xuất bản,
// bắt đầu từ ngày mai (giờ mở cửa theo đúng thứ trong tuần). "Dùng lịch này" đưa sang UX-04;
// đã đăng nhập thì chọn và lưu luôn, khách thì xem 3 phương án rồi được yêu cầu đăng nhập khi chọn.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import { PlanTimeline, dayLabel } from "@/components/plan-timeline";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { BUDGET_LABEL, PACE_LABEL, TRAVEL_WITH_LABEL } from "@/lib/labels";
import { addDays, formatVnd } from "@/lib/places";
import { setPendingAction } from "@/lib/pending-action";
import { generatePlans } from "@/lib/reco/generate-plans";
import { getSample } from "@/lib/samples";
import { saveTripInput } from "@/lib/trip-draft";
import type { Place, TripInput } from "@/lib/types";
import { useToday } from "@/lib/use-today";

export function SampleView({ sampleId, places }: { sampleId: string; places: Place[] }) {
  const router = useRouter();
  const auth = useAuth();
  const today = useToday();
  const sample = getSample(sampleId)!;
  const placesById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);

  const input: TripInput | null = useMemo(
    () => (today ? { ...sample.input, start_date: addDays(today, 1) } : null),
    [today, sample],
  );
  const plan = useMemo(
    () => (input ? generatePlans(input, places).find((p) => p.plan_type === sample.plan_type)! : null),
    [input, places, sample],
  );

  if (!input || !plan) return null;

  function useThis() {
    saveTripInput(input!);
    // Đã đăng nhập: màn 3 phương án tự chọn đúng phương án của lịch mẫu và lưu (hành động chờ).
    if (auth.status === "signed_in") setPendingAction({ type: "select_plan", plan_type: sample.plan_type });
    router.push("/plans");
  }

  function customize() {
    saveTripInput(input!);
    router.push("/onboarding");
  }

  const errors = plan.issues.filter((i) => i.severity === "error");

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-4 px-4 pt-5 pb-8">
        <Link href="/explore" className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Khám phá
        </Link>

        <header className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-semibold">{sample.title}</h1>
            {plan.feasible ? (
              <Badge className="bg-emerald-600 text-white">
                <CheckCircle2 />
                Khả thi
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-900">
                <AlertTriangle />
                Cần xem lại
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{sample.description}</p>
          <p className="text-xs text-muted-foreground">
            Lịch mẫu · {plan.title} · {input.day_count} ngày từ ngày mai · {TRAVEL_WITH_LABEL[input.travel_with]} ·
            Ngân sách {BUDGET_LABEL[input.budget_level].toLowerCase()} · Nhịp {PACE_LABEL[input.pace].toLowerCase()}
          </p>
        </header>

        <ul className="space-y-1.5">
          {plan.reasons.map((r, i) => (
            <li key={i} className="flex gap-1.5 text-sm">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden />
              {r.text}
            </li>
          ))}
        </ul>

        <div className="rounded-lg bg-muted/60 p-3">
          <p className="text-sm">
            Chi phí ước tính: <span className="font-semibold">~{formatVnd(plan.est_cost_per_person_vnd)}/người</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Chi phí ước tính, chưa được nhà cung cấp xác nhận. Gồm vé và ăn uống, chưa gồm lưu trú, di chuyển.
          </p>
        </div>

        {errors.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            {errors.map((e, i) => (
              <li key={i}>• {e.message}</li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" onClick={useThis}>
            Dùng lịch này
          </Button>
          <Button size="lg" variant="outline" onClick={customize}>
            Tùy chỉnh
          </Button>
        </div>

        {plan.days.map((d) => (
          <section key={d.day_no}>
            <h2 className="mb-2 text-sm font-semibold">{dayLabel(d)}</h2>
            <PlanTimeline day={d} placesById={placesById} issues={plan.issues} />
          </section>
        ))}

        <Link href="/explore" className={buttonVariants({ variant: "ghost", className: "w-full" })}>
          Xem lịch mẫu khác
        </Link>
      </div>
    </div>
  );
}
