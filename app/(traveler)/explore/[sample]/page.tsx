// UC-01 Xem lịch mẫu – chi tiết một lịch mẫu (FR-F1-01). Khách xem không cần tài khoản.
// Cache Components + Partial Prefetching: params được await BÊN TRONG <Suspense> để trang có vỏ tĩnh.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPublishedPlaces } from "@/lib/data/places";
import { SAMPLE_TRIPS, getSample } from "@/lib/samples";
import { SampleView } from "./_components/sample-view";

export function generateStaticParams() {
  return SAMPLE_TRIPS.map((s) => ({ sample: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/explore/[sample]">): Promise<Metadata> {
  const s = getSample((await params).sample);
  return { title: s ? `${s.title} · HueTrip` : "Lịch mẫu · HueTrip" };
}

export default function SamplePage({ params }: PageProps<"/explore/[sample]">) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse bg-muted" />}>
      <SampleContent params={params} />
    </Suspense>
  );
}

async function SampleContent({ params }: { params: PageProps<"/explore/[sample]">["params"] }) {
  const sample = getSample((await params).sample);
  if (!sample) notFound();
  const places = await getPublishedPlaces();
  return <SampleView sampleId={sample.id} places={places} />;
}
