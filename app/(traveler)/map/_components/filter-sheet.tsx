"use client";

// UX-02 – Bảng bộ lọc (mở từ dưới lên trên điện thoại).
// FR-F8-05: mọi lớp lọc "Đang mở cửa"; Ăn uống lọc mức giá + món chay; Lưu trú lọc loại hình + giá/đêm.
// AC-F8.2-02: "Xóa bộ lọc" đưa về mặc định.

import { Chip } from "@/components/chip";
import { KindIcon } from "@/components/layer-icon";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  FOOD_PRICE_TIERS,
  LODGING_LABEL,
  STAY_PRICE_TIERS,
  type FoodPriceTier,
  type MapFilters,
  type StayPriceTier,
} from "@/lib/places";
import type { LodgingType } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: MapFilters;
  resultCount: number;
  onFiltersChange: (f: MapFilters) => void;
  onReset: () => void;
};

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function FilterSheet({ open, onOpenChange, filters, resultCount, onFiltersChange, onReset }: Props) {
  const food = filters.layers.includes("food");
  const stay = filters.layers.includes("stay");
  const set = (patch: Partial<MapFilters>) => onFiltersChange({ ...filters, ...patch });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[85dvh] w-full max-w-[390px] gap-0 rounded-t-xl"
      >
        <SheetHeader className="border-b">
          <SheetTitle>Bộ lọc</SheetTitle>
          <SheetDescription>Kết quả cập nhật ngay trên bản đồ và danh sách.</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 overflow-y-auto p-4">
          <Section title="Chung">
            <Chip active={filters.openNow} onClick={() => set({ openNow: !filters.openNow })}>
              Đang mở cửa
            </Chip>
          </Section>

          {food && (
            <Section title="Ăn uống" icon={<KindIcon kind="food" />}>
              {FOOD_PRICE_TIERS.map((t) => (
                <Chip
                  key={t.id}
                  active={filters.foodPrice.includes(t.id)}
                  onClick={() => set({ foodPrice: toggle<FoodPriceTier>(filters.foodPrice, t.id) })}
                >
                  {t.label}
                </Chip>
              ))}
              <Chip active={filters.vegetarian} onClick={() => set({ vegetarian: !filters.vegetarian })}>
                Có món chay
              </Chip>
              <Hint>Mức giá tính theo người.</Hint>
            </Section>
          )}

          {stay && (
            <Section title="Lưu trú" icon={<KindIcon kind="stay" />}>
              {(["hotel", "homestay"] as const).map((t) => (
                <Chip
                  key={t}
                  active={filters.lodging.includes(t)}
                  onClick={() => set({ lodging: toggle<LodgingType>(filters.lodging, t) })}
                >
                  <KindIcon kind={t} />
                  {LODGING_LABEL[t]}
                </Chip>
              ))}
              <div className="basis-full" />
              {STAY_PRICE_TIERS.map((t) => (
                <Chip
                  key={t.id}
                  active={filters.stayPrice.includes(t.id)}
                  onClick={() => set({ stayPrice: toggle<StayPriceTier>(filters.stayPrice, t.id) })}
                >
                  {t.label}
                </Chip>
              ))}
              <Hint>Giá tính theo đêm.</Hint>
            </Section>
          )}

          {!food && !stay && (
            <p className="text-sm text-muted-foreground">
              Bật lớp Ăn uống hoặc Lưu trú để thấy thêm bộ lọc riêng của lớp đó.
            </p>
          )}
        </div>

        <div className="flex gap-2 border-t p-4">
          <Button variant="outline" size="lg" className="flex-1" onClick={onReset}>
            Xóa bộ lọc
          </Button>
          <Button size="lg" className="flex-1" onClick={() => onOpenChange(false)}>
            Xem {resultCount} kết quả
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="basis-full text-xs text-muted-foreground">{children}</p>;
}
