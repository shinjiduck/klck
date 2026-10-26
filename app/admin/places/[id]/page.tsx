// UX-A2 Sửa địa điểm. FR-ADM-02, FR-ADM-03, AC-ADM-01.
// params được await bên trong <Suspense> (Cache Components + Partial Prefetching).

import { Suspense } from "react";
import { PlaceForm } from "../_components/place-form";

export default function EditPlacePage({ params }: PageProps<"/admin/places/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải…</p>}>
      <EditPlace params={params} />
    </Suspense>
  );
}

async function EditPlace({ params }: { params: PageProps<"/admin/places/[id]">["params"] }) {
  const { id } = await params;
  return <PlaceForm placeId={id} />;
}
