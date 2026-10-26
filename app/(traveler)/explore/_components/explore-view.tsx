"use client";

// Tab "Khám phá": lịch mẫu (UC-01) + bộ sưu tập địa điểm (mở trên Hue Map).

import Link from "next/link";
import { useMemo } from "react";
import { ChevronRight, Route } from "lucide-react";
import { cn } from "cn";
import { KIND_SOFT, KindIcon, placeKind } from "@/components/layer-icon";
import { PACE_LABEL, TRAVEL_WITH_LABEL } from "@/lib/labels";
import { COLLECTIONS, SAMPLE_TRIPS } from "@/lib/samples";
import type { Place } from "@/lib/types";

export function ExploreView({ places }: { places: Place[] }) {
  const collections = useMemo(
    () => COLLECTIONS.map((c) => ({ ...c, places: places.filter(c.match) })).filter((c) => c.places.length > 0),
    [places],
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-6 px-4 pt-5 pb-8">
        <header>
          <h1 className="text-xl font-semibold">Khám phá Huế</h1>
          <p className="mt-1 text-sm text-muted-foreground">Lịch mẫu có sẵn và địa điểm theo chủ đề. Không cần tài khoản.</p>
        </header>

        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-base font-semibold">
            <Route className="size-4" aria-hidden />
            Lịch mẫu
          </h2>
          <ul className="space-y-2">
            {SAMPLE_TRIPS.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/explore/${s.id}`}
                  className="flex items-center gap-3 rounded-xl border p-3 hover:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {s.input.day_count} ngày · {TRAVEL_WITH_LABEL[s.input.travel_with]} · Nhịp{" "}
                      {PACE_LABEL[s.input.pace].toLowerCase()}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {collections.map((c) => (
          <section key={c.id} className="space-y-2">
            <div>
              <h2 className="text-base font-semibold">{c.title}</h2>
              <p className="text-xs text-muted-foreground">{c.description}</p>
            </div>
            <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {c.places.map((p) => {
                const kind = placeKind(p);
                return (
                  <li key={p.id} className="w-40 shrink-0">
                    <Link href={`/map?place=${p.id}`} className="block rounded-xl border p-2.5 hover:bg-muted">
                      <span className={cn("flex h-16 items-center justify-center rounded-lg", KIND_SOFT[kind])}>
                        <KindIcon kind={kind} className="size-6" />
                      </span>
                      <span className="mt-2 line-clamp-2 block text-xs font-medium">{p.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
