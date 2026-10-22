"use client";

// UX-04 Chọn 1 trong 3 phương án.
// AC-F1-02: tối đa 3 phương án phân biệt rõ, mỗi phương án có lý do và chi phí ước tính kèm ghi chú
// "chi phí ước tính, chưa được nhà cung cấp xác nhận". FR-F1-03: trạng thái khả thi + số điểm mỗi ngày.
// AC-F1-04: phương án vi phạm ràng buộc không được gắn "Khả thi"; người dùng chỉ chọn được khi
// chấp nhận ngoại lệ. UC-04 bước 5: chọn phương án khi chưa đăng nhập → yêu cầu đăng nhập để lưu;
// hành động được giữ lại và thực hiện tiếp sau khi đăng nhập (AC-F8.3-01).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Info, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { PlanTimeline, dayLabel } from "@/components/plan-timeline";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { BUDGET_LABEL, PACE_LABEL, TRAVEL_WITH_LABEL, WEEKDAY_SHORT } from "@/lib/labels";
import { formatVnd, weekdayOf } from "@/lib/places";
import { generatePlans } from "@/lib/reco/generate-plans";
import { AccountButton } from "@/components/account-button";
import { needsLogin, useAuth } from "@/lib/auth";
import { setPendingAction, takePendingAction } from "@/lib/pending-action";
import { readTripDraft, selectPlan, useTripDraft } from "@/lib/trip-draft";
import { saveDraftToServer } from "@/lib/trip-sync";
import type { GeneratedPlan, Place, TripInput } from "@/lib/types";

export function PlansView({ places }: { places: Place[] }) {
  const router = useRouter();
  const auth = useAuth();
  const draft = useTripDraft();
  const placesById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  // Sinh lại theo đầu vào; không phụ thuộc vào phương án đã chọn để danh sách không đổi khi chọn.
  const inputKey = draft ? JSON.stringify(draft.input) : "";
  const plans = useMemo(
    () => (inputKey ? generatePlans(JSON.parse(inputKey) as TripInput, places) : []),
    [inputKey, places],
  );

  const choose = useCallback(
    async (plan: GeneratedPlan) => {
      if (needsLogin(auth)) {
        setPendingAction({ type: "select_plan", plan_type: plan.plan_type });
        toast.info("Đăng nhập để lưu chuyến đi", { description: "Sau khi đăng nhập, phương án này sẽ được chọn tiếp." });
        router.push("/login?next=/plans");
        return;
      }
      selectPlan(plan);
      if (auth.status === "signed_in") {
        try {
          await saveDraftToServer(readTripDraft()!, auth.user.id);
          toast.success(`Đã lưu "${plan.title}" vào tài khoản`);
        } catch (e) {
          console.error(e);
          toast.error("Đã chọn trên máy nhưng chưa lưu được lên tài khoản. Thử lại sau.");
        }
      } else {
        toast.success(`Đã chọn "${plan.title}"`);
      }
      router.push("/trip");
    },
    [auth, router],
  );

  // Quay lại sau khi đăng nhập: làm tiếp hành động "chọn phương án" đang chờ.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || auth.status !== "signed_in" || plans.length === 0) return;
    const pending = takePendingAction("select_plan");
    if (!pending) return;
    resumed.current = true;
    const plan = plans.find((p) => p.plan_type === pending.plan_type);
    if (plan) void choose(plan);
  }, [auth.status, plans, choose]);

  if (draft === undefined) return <PlansSkeleton />;
  if (draft === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="font-medium">Chưa có thông tin chuyến đi</p>
        <p className="text-sm text-muted-foreground">Khai sở thích để nhận 3 phương án lịch trình.</p>
        <Link href="/onboarding" className={buttonVariants()}>
          Lên lịch trình
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-4 px-4 pt-5 pb-6">
        <header>
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-semibold">Chọn 1 trong 3 phương án</h1>
            <AccountButton className="shrink-0" />
          </div>
          <InputSummary input={draft.input} />
        </header>

        {plans.map((plan) => (
          <PlanCard
            key={plan.plan_type}
            plan={plan}
            placesById={placesById}
            selected={draft.selected?.plan_type === plan.plan_type}
            onChoose={choose}
          />
        ))}

        {auth.status !== "signed_in" && (
          <p className="flex gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            {auth.status === "disabled"
              ? "Chế độ dữ liệu giả: phương án đã chọn chỉ lưu trên trình duyệt này."
              : "Bạn xem 3 phương án không cần tài khoản. Khi chọn, HueTrip sẽ yêu cầu đăng nhập để lưu chuyến đi."}
          </p>
        )}
      </div>
    </div>
  );
}

function InputSummary({ input }: { input: TripInput }) {
  const [, m, d] = input.start_date.split("-");
  return (
    <div className="mt-1 flex items-start justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        {input.day_count} ngày từ {WEEKDAY_SHORT[weekdayOf(input.start_date)]} {d}/{m} ·{" "}
        {TRAVEL_WITH_LABEL[input.travel_with]} · {input.party_size} người · Ngân sách{" "}
        {BUDGET_LABEL[input.budget_level].toLowerCase()} · Nhịp {PACE_LABEL[input.pace].toLowerCase()}
      </p>
      <Link
        href="/onboarding"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
      >
        <Pencil data-icon="inline-start" />
        Sửa
      </Link>
    </div>
  );
}

function PlanCard({
  plan,
  placesById,
  selected,
  onChoose,
}: {
  plan: GeneratedPlan;
  placesById: Map<string, Place>;
  selected: boolean;
  onChoose: (plan: GeneratedPlan) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const errors = plan.issues.filter((i) => i.severity === "error");
  const warnings = plan.issues.filter((i) => i.severity === "warning");
  const choose = () => onChoose(plan);

  return (
    <article className={cn("rounded-xl border bg-card p-4 shadow-sm", selected && "border-primary ring-1 ring-primary")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{plan.title}</h2>
          <p className="text-xs text-muted-foreground">{plan.summary}</p>
        </div>
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

      {/* Số điểm mỗi ngày (FR-F1-03) */}
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {plan.days.map((d) => (
          <li key={d.day_no} className="rounded-md bg-muted px-2 py-1 text-xs">
            {dayLabel(d)}: <span className="font-medium">{d.items.length} điểm</span>
          </li>
        ))}
      </ul>

      <ul className="mt-3 space-y-1.5">
        {plan.reasons.map((r, i) => (
          <li key={i} className="flex gap-1.5 text-sm">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden />
            {r.text}
          </li>
        ))}
      </ul>

      <div className="mt-3 rounded-lg bg-muted/60 p-3">
        <p className="text-sm">
          Chi phí ước tính: <span className="font-semibold">~{formatVnd(plan.est_cost_per_person_vnd)}/người</span>
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Chi phí ước tính, chưa được nhà cung cấp xác nhận. Gồm vé và ăn uống, chưa gồm lưu trú, di chuyển.
          {plan.unknown_price_count > 0 && ` Có ${plan.unknown_price_count} mục chưa rõ giá, chưa cộng vào tổng.`}
        </p>
      </div>

      {errors.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {errors.map((e, i) => (
            <li key={i}>• {e.message}</li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <details className="mt-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer">{warnings.length} lưu ý</summary>
          <ul className="mt-1 space-y-0.5 pl-3">
            {warnings.map((w, i) => (
              <li key={i}>• {w.message}</li>
            ))}
          </ul>
        </details>
      )}

      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="mt-3 flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-sm font-medium hover:bg-muted"
      >
        {open ? "Thu gọn lịch" : "Xem lịch chi tiết"}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className="mt-2 space-y-4">
          {plan.days.map((d) => (
            <section key={d.day_no}>
              <h3 className="mb-2 text-sm font-semibold">{dayLabel(d)}</h3>
              <PlanTimeline day={d} placesById={placesById} issues={plan.issues} />
            </section>
          ))}
        </div>
      )}

      <div className="mt-3">
        {plan.feasible ? (
          <Button size="lg" className="w-full" onClick={choose}>
            {selected ? "Đang dùng phương án này" : "Chọn phương án này"}
          </Button>
        ) : confirming ? (
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm">
              Phương án còn {errors.length} vấn đề chưa xử lý. Bạn vẫn muốn chọn và tự điều chỉnh sau?
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirming(false)}>
                Quay lại
              </Button>
              <Button className="flex-1" onClick={choose}>
                Vẫn chọn
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="lg" className="w-full" onClick={() => setConfirming(true)}>
            Chọn dù còn vấn đề
          </Button>
        )}
      </div>
    </article>
  );
}

function PlansSkeleton() {
  return (
    <div className="space-y-4 px-4 pt-5" aria-hidden>
      <div className="h-7 w-2/3 animate-pulse rounded bg-muted" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-52 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}
