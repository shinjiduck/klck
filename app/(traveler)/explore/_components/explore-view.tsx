"use client";

// Tab "Khám phá": lịch mẫu (UC-01) + bộ sưu tập địa điểm (mở trên Hue Map).

import Link from "next/link";
import { useMemo } from "react";
import { ChevronRight, Route } from "lucide-react";
import { HeroBanner } from "@/components/hero-banner";
import { PlaceImage } from "@/components/place-image";
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
        <HeroBanner eyebrow="Khám phá" title="Huế theo cách của bạn">
          Lịch mẫu dựng sẵn và địa điểm theo chủ đề. Xem thoải mái, không cần tài khoản.
        </HeroBanner>

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
                  className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-[family-name:var(--font-display)] text-base font-semibold">{s.title}</p>
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
                return (
                  <li key={p.id} className="w-44 shrink-0">
                    <Link href={`/map?place=${p.id}`} className="block overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-md">
                      <PlaceImage place={p} className="h-28 w-full" />
                      <span className="line-clamp-2 block px-2.5 py-2 text-xs font-medium">{p.name}</span>
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
