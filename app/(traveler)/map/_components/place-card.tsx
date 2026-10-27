"use client";

// UX-03 Thẻ địa điểm (frame "03 DIA DIEM") – ngăn kéo nửa màn hình trên điện thoại.
// FR-F8-07, FR-F8-09; AC-F8.2-03 (đủ trường tối thiểu), AC-F8.2-05 (giá trị thật kèm nguồn,
// thiếu thì "Không xác định"), AC-F8.2-06 (thời gian tham quan gợi ý), AC-F8.3-06 (Chỉ đường),
// AC-F8.4-02/03 (nhãn "Hợp với bạn" chỉ khi đủ dữ liệu), BR-MAP-05 (đánh dấu nội dung tài trợ).
// "Thêm vào lịch" (FR-F8-08) mở bước chọn ngày/giờ + UX-05 xung đột (add-to-trip.tsx).

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarPlus, Car, Clock, Info, MapPin, Navigation, Route, Ticket, Timer } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { KindIcon, placeKind } from "@/components/layer-icon";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import {
  LAYER_LABEL,
  LODGING_LABEL,
  UNKNOWN,
  directionsUrl,
  formatUpdatedMonth,
  getOpenStatus,
  getPriceText,
} from "@/lib/places";
import type { Category, LatLng, Place, PlaceMatch } from "@/lib/types";
import { needsLogin, useAuth } from "@/lib/auth";
import { formatRoadDistance, useRoadDistance } from "@/lib/map/use-road-distance";
import { setPendingAction } from "@/lib/pending-action";
import { preferenceFromDraft, useTripDraft } from "@/lib/trip-draft";
import { useAiReason } from "@/lib/use-ai-reason";
import { PlaceImage } from "@/components/place-image";
import { AddToTrip, type TripContext } from "./add-to-trip";
import { OPEN_TONE } from "./place-list-sheet";

type Props = {
  place: Place | null;
  category: Category | undefined;
  match: PlaceMatch | null;
  userLocation: LatLng | null;
  now: Date;
  onClose: () => void;
  /** Lịch đã chọn ở UX-04; null = chưa có lịch. */
  trip: TripContext | null;
  places: Place[];
  /** Gọi sau khi thêm điểm thành công. */
  onAdded: (dayNo: number) => void;
  /** Mở thẳng bước "Thêm vào lịch" (quay lại sau khi đăng nhập – AC-F8.3-01). */
  startAdding?: boolean;
  /** AC-F8.2-06: điểm trước đó trong lịch của ngày đang xem / hôm nay (để tính thời gian đi). */
  prevStop: { name: string; label: string; location: LatLng } | null;
};

export function PlaceCard({ place, onClose, ...rest }: Props) {
  return (
    <Drawer open={place != null} onOpenChange={(open) => !open && onClose()} showSwipeHandle>
      <DrawerContent className="mx-auto w-full max-w-[390px]">
        {/* key: đổi địa điểm thì quay về màn chi tiết */}
        {place && <CardInner key={place.id} place={place} {...rest} />}
      </DrawerContent>
    </Drawer>
  );
}

function CardInner({
  place,
  trip,
  places,
  onAdded,
  startAdding = false,
  ...rest
}: Omit<Props, "place" | "onClose"> & { place: Place }) {
  const router = useRouter();
  const auth = useAuth();
  const [adding, setAdding] = useState(startAdding);

  if (adding && trip) {
    return <AddToTrip place={place} trip={trip} places={places} onBack={() => setAdding(false)} onDone={onAdded} />;
  }
  return (
    <PlaceCardBody
      place={place}
      {...rest}
      onAdd={() => {
        if (needsLogin(auth)) {
          // Ma trận quyền: khách không thêm điểm vào lịch → giữ hành động, đăng nhập xong quay lại đúng địa điểm.
          setPendingAction({ type: "add_place", place_id: place.id });
          toast.info("Đăng nhập để thêm vào lịch", { description: "Sau khi đăng nhập, bạn sẽ quay lại đúng địa điểm này." });
          router.push(`/login?next=${encodeURIComponent(`/map?place=${place.id}`)}`);
        } else if (trip) setAdding(true);
        else
          toast.info("Bạn chưa có lịch trình", {
            description: "Khai sở thích để nhận 3 phương án, rồi thêm điểm từ bản đồ.",
            action: { label: "Lên lịch", onClick: () => router.push("/onboarding") },
          });
      }}
    />
  );
}

function PlaceCardBody({
  place,
  category,
  match,
  userLocation,
  now,
  onAdd,
  prevStop,
}: Pick<Props, "category" | "match" | "userLocation" | "now" | "prevStop"> & { place: Place; onAdd: () => void }) {
  const kind = placeKind(place);
  const draft = useTripDraft();
  const ai = useAiReason(place.id, preferenceFromDraft(draft), match != null);
  const status = getOpenStatus(place, now);
  const price = getPriceText(place);
  const travel = useRoadDistance(userLocation, place.location);
  const fromPrev = useRoadDistance(prevStop && prevStop.name !== place.name ? prevStop.location : null, place.location);
  const categoryLabel =
    place.layer === "stay" && place.lodging_type
      ? LODGING_LABEL[place.lodging_type]
      : (category?.name ?? LAYER_LABEL[place.layer]);
  const hoursText = status.todayText ?? UNKNOWN;

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        <PlaceImage place={place} className="h-44 w-full rounded-2xl" showLabel />

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">
            <KindIcon kind={kind} />
            {categoryLabel}
          </Badge>
          {place.is_sponsored && <Badge variant="outline">Tài trợ</Badge>}
          {match && (
            <Badge className="bg-emerald-600 text-white">{match.level === "match" ? "Hợp với bạn" : "Có thể phù hợp"}</Badge>
          )}
        </div>

        <DrawerTitle className="mt-2 text-2xl leading-tight font-semibold">{place.name}</DrawerTitle>
        <DrawerDescription className={cn("mt-0.5 text-sm font-medium", OPEN_TONE[status.state])}>
          {status.label}
        </DrawerDescription>

        {match && match.reasons.length > 0 && (
          <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
            <ul className="space-y-1">
              {/* Câu đầu: bản Claude viết lại khi đã về, trước đó là câu mẫu theo reason code. */}
              <li>{ai?.text ?? match.reasons[0].text}</li>
              {match.reasons.slice(1, 3).map((r) => (
                <li key={r.code}>{r.text}</li>
              ))}
            </ul>
            {ai?.source === "ai" && <p className="mt-1 text-[11px] text-emerald-800/70">Diễn giải bởi AI từ dữ liệu địa điểm</p>}
          </div>
        )}

        {/* AC-F8.2-05: dòng tóm tắt giá trị thật kèm nguồn */}
        <p className="mt-3 text-sm">
          {status.todayText == null
            ? `Giờ mở cửa: ${UNKNOWN}`
            : status.todayText === "Nghỉ"
              ? "Hôm nay nghỉ"
              : `Mở cửa ${status.todayText}`}{" "}
          · {price === UNKNOWN ? `Giá: ${UNKNOWN}` : price}
        </p>

        <dl className="mt-3 space-y-2 text-sm">
          <Row icon={Clock} label="Giờ hôm nay" value={hoursText} />
          <Row icon={Ticket} label={place.layer === "stay" ? "Giá phòng" : "Giá"} value={price} />
          {place.layer !== "stay" && (
            <Row
              icon={Timer}
              label="Thời gian tham quan gợi ý"
              value={place.visit_duration_min ? `Khoảng ${place.visit_duration_min} phút` : UNKNOWN}
            />
          )}
          <Row
            icon={Route}
            label="Khoảng cách"
            value={travel ? `Từ vị trí của bạn: ${formatRoadDistance(travel)}` : "Bấm “Vị trí của tôi” trên bản đồ để xem"}
          />
          {fromPrev && prevStop && <Row icon={Car} label={prevStop.label} value={formatRoadDistance(fromPrev)} />}
          <Row icon={MapPin} label="Địa chỉ" value={[place.address, place.ward].filter(Boolean).join(", ") || UNKNOWN} />
        </dl>

        {place.description && <p className="mt-3 text-sm text-muted-foreground">{place.description}</p>}

        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            Nguồn: {place.source} · Cập nhật {formatUpdatedMonth(place.updated_at)}
          </span>
        </p>
      </div>

      <div className="flex shrink-0 gap-2 border-t p-4">
        <Button size="lg" className="flex-1" onClick={onAdd}>
          <CalendarPlus data-icon="inline-start" />
          Thêm vào lịch
        </Button>
        <a
          href={directionsUrl(place.location)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "flex-1")}
        >
          <Navigation data-icon="inline-start" />
          Chỉ đường
        </a>
      </div>
    </>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd>{value}</dd>
      </div>
    </div>
  );
}
