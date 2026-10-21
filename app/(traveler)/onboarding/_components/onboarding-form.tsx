"use client";

// UX-01 Khai sở thích (frame "01 SOTHICH").
// FR-F1-02: sở thích (nhiều), ngày bắt đầu, số ngày, đi cùng ai, số người, ngân sách, nhịp độ,
// điểm bắt buộc (tùy chọn). AC-F1-01: đủ ngày, số người, ngân sách, ≥ 1 sở thích là tạo được bản nháp,
// chưa cần tài khoản. BR-PREF-01: điểm bắt buộc tách khỏi sở thích. BR-PREF-02: ăn chay chỉ khi tự khai.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, type Control } from "react-hook-form";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { z } from "zod";
import { cn } from "cn";
import { Chip } from "@/components/chip";
import { KindIcon } from "@/components/layer-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BUDGET_LABEL, INTEREST_LABEL, PACE_LABEL, TRAVEL_WITH_LABEL } from "@/lib/labels";
import { addDays, todayInHue } from "@/lib/places";
import { saveTripInput, useTripDraft } from "@/lib/trip-draft";
import type { BudgetLevel, Interest, Pace, PlaceLayer, TravelWith, TripInput } from "@/lib/types";
import { zodResolver } from "@/lib/zod-resolver";

const INTERESTS = Object.keys(INTEREST_LABEL) as Interest[];
const TRAVEL_WITH = Object.keys(TRAVEL_WITH_LABEL) as TravelWith[];
const BUDGETS = Object.keys(BUDGET_LABEL) as BudgetLevel[];
const PACES = Object.keys(PACE_LABEL) as Pace[];
const MAX_DAYS = 4;

const BUDGET_HINT: Record<BudgetLevel, string> = {
  saving: "Quán bình dân, ưu tiên điểm miễn phí",
  moderate: "Cân đối giữa vé và ăn uống",
  comfortable: "Có nhà hàng, ít giới hạn chi phí",
};

const PACE_HINT: Record<Pace, string> = {
  relaxed: "2 điểm/ngày",
  normal: "3 điểm/ngày",
  packed: "4 điểm/ngày",
};

const schema = z
  .object({
    interests: z.array(z.enum(INTERESTS as [Interest, ...Interest[]])).min(1, "Chọn ít nhất 1 sở thích."),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Chọn ngày bắt đầu."),
    day_count: z.number().int().min(1).max(MAX_DAYS),
    travel_with: z.enum(TRAVEL_WITH as [TravelWith, ...TravelWith[]]),
    party_size: z.number({ error: "Nhập số người." }).int().min(1, "Ít nhất 1 người.").max(30, "Tối đa 30 người."),
    budget_level: z.enum(BUDGETS as [BudgetLevel, ...BudgetLevel[]]),
    pace: z.enum(PACES as [Pace, ...Pace[]]),
    must_have_place_ids: z.array(z.string()),
    dietary: z.array(z.literal("vegetarian")),
  })
  .superRefine((v, ctx) => {
    if (v.start_date < todayInHue()) {
      ctx.addIssue({ code: "custom", path: ["start_date"], message: "Ngày bắt đầu không được ở quá khứ." });
    }
  });

type Sight = { id: string; name: string; layer: PlaceLayer };

export function OnboardingForm({ sights }: { sights: Sight[] }) {
  const draft = useTripDraft();
  // Chờ đọc bản nháp (và ngày hôm nay) ở trình duyệt để không lệch giữa server và client.
  if (draft === undefined) return <FormSkeleton />;
  return <Form sights={sights} initial={draft?.input ?? defaultInput()} />;
}

function defaultInput(): TripInput {
  return {
    interests: [],
    start_date: addDays(todayInHue(), 1),
    day_count: 2,
    travel_with: "couple",
    party_size: 2,
    budget_level: "moderate",
    pace: "normal",
    must_have_place_ids: [],
    dietary: [],
  };
}

function Form({ sights, initial }: { sights: Sight[]; initial: TripInput }) {
  const router = useRouter();
  const [mustOpen, setMustOpen] = useState(initial.must_have_place_ids.length > 0);
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TripInput>({
    resolver: zodResolver(schema as z.ZodType<TripInput>),
    defaultValues: initial,
  });

  const onSubmit = (values: TripInput) => {
    saveTripInput(values);
    router.push("/plans");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col" noValidate>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pt-5 pb-6">
        <header>
          <h1 className="text-xl font-semibold">Lên lịch đi Huế</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cho HueTrip biết bạn thích gì, hệ thống sẽ gợi ý 3 phương án lịch trình. Chưa cần tài khoản.
          </p>
        </header>

        <Field label="Bạn thích gì?" hint="Chọn một hoặc nhiều" error={errors.interests?.message}>
          <ChipMulti
            control={control}
            name="interests"
            options={INTERESTS.map((v) => ({ value: v, label: INTEREST_LABEL[v] }))}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Ngày bắt đầu" error={errors.start_date?.message}>
            <Input type="date" min={todayInHue()} className="h-10" {...register("start_date")} />
          </Field>
          <Field label="Số ngày">
            <Controller
              control={control}
              name="day_count"
              render={({ field }) => (
                <Stepper value={field.value} min={1} max={MAX_DAYS} onChange={field.onChange} unit="ngày" />
              )}
            />
          </Field>
        </div>

        <Field label="Đi cùng ai?">
          <Controller
            control={control}
            name="travel_with"
            render={({ field }) => (
              <div className="flex flex-wrap gap-2">
                {TRAVEL_WITH.map((v) => (
                  <Chip
                    key={v}
                    active={field.value === v}
                    onClick={() => {
                      field.onChange(v);
                      if (v === "solo") setValue("party_size", 1);
                      if (v === "couple") setValue("party_size", 2);
                    }}
                  >
                    {TRAVEL_WITH_LABEL[v]}
                  </Chip>
                ))}
              </div>
            )}
          />
        </Field>

        <Field label="Số người" error={errors.party_size?.message}>
          <Controller
            control={control}
            name="party_size"
            render={({ field }) => (
              <Stepper value={field.value} min={1} max={30} onChange={field.onChange} unit="người" />
            )}
          />
        </Field>

        <Field label="Ngân sách">
          <Controller
            control={control}
            name="budget_level"
            render={({ field }) => (
              <OptionCards
                value={field.value}
                onChange={field.onChange}
                options={BUDGETS.map((v) => ({ value: v, label: BUDGET_LABEL[v], hint: BUDGET_HINT[v] }))}
              />
            )}
          />
        </Field>

        <Field label="Nhịp độ">
          <Controller
            control={control}
            name="pace"
            render={({ field }) => (
              <OptionCards
                value={field.value}
                onChange={field.onChange}
                options={PACES.map((v) => ({ value: v, label: PACE_LABEL[v], hint: PACE_HINT[v] }))}
              />
            )}
          />
        </Field>

        <Field label="Ăn uống" hint="Chỉ khai nếu bạn muốn">
          <ChipMulti
            control={control}
            name="dietary"
            options={[{ value: "vegetarian", label: "Tôi ăn chay" }]}
          />
        </Field>

        <section>
          <button
            type="button"
            aria-expanded={mustOpen}
            onClick={() => setMustOpen((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <span>
              <span className="block text-sm font-semibold">Điểm bắt buộc</span>
              <span className="block text-xs text-muted-foreground">Không bắt buộc · nơi bạn nhất định muốn đến</span>
            </span>
            <ChevronDown className={cn("size-4 transition-transform", mustOpen && "rotate-180")} aria-hidden />
          </button>
          {mustOpen && (
            <div className="mt-3">
              <Controller
                control={control}
                name="must_have_place_ids"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {sights.map((s) => {
                      const on = field.value.includes(s.id);
                      return (
                        <Chip
                          key={s.id}
                          active={on}
                          className="h-auto min-h-8 py-1 whitespace-normal"
                          onClick={() =>
                            field.onChange(on ? field.value.filter((x) => x !== s.id) : [...field.value, s.id])
                          }
                        >
                          <KindIcon kind={s.layer} />
                          {s.name}
                        </Chip>
                      );
                    })}
                  </div>
                )}
              />
            </div>
          )}
        </section>
      </div>

      <div className="shrink-0 border-t bg-background p-4">
        <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={isSubmitting}>
          Gợi ý 3 phương án
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function ChipMulti<K extends "interests" | "dietary">({
  control,
  name,
  options,
}: {
  control: Control<TripInput>;
  name: K;
  options: { value: TripInput[K][number]; label: string }[];
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const value = field.value as string[];
        return (
          <div className="flex flex-wrap gap-2">
            {options.map((o) => {
              const on = value.includes(o.value);
              return (
                <Chip
                  key={o.value}
                  active={on}
                  onClick={() => field.onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}
                >
                  {o.label}
                </Chip>
              );
            })}
          </div>
        );
      }}
    />
  );
}

function OptionCards<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint: string }[];
}) {
  return (
    <div role="radiogroup" className="grid grid-cols-3 gap-2">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-lg border p-2.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              on ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted",
            )}
          >
            <span className="block text-sm font-medium">{o.label}</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{o.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  unit,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex h-10 items-center justify-between rounded-lg border px-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Giảm ${unit}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus />
      </Button>
      <span className="text-sm font-medium tabular-nums" aria-live="polite">
        {value} {unit}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Tăng ${unit}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus />
      </Button>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-6 px-4 pt-5" aria-hidden>
      <div className="h-7 w-1/2 animate-pulse rounded bg-muted" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded-lg bg-muted" />
        </div>
      ))}
    </div>
  );
}
