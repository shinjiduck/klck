"use client";

// UX-A2 Form thêm/sửa địa điểm (UC-14).
// FR-ADM-02: chấm tọa độ trên bản đồ nhỏ; nguồn và ngày cập nhật bắt buộc khi xuất bản.
// FR-ADM-03: Lưu nháp / Xuất bản / Ẩn; xóa vĩnh viễn (chỉ admin) cần xác nhận lần hai.
// AC-ADM-01: thiếu nguồn hoặc ngày cập nhật mà bấm Xuất bản → báo lỗi ngay tại trường, chỉ cho lưu nháp.
// AC-SUP-03: trùng tên trong bán kính 100 m → cảnh báo.
// Mọi thao tác ghi đi qua Route Handler (kiểm tra quyền) → RLS → trigger AUDIT_LOG.

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { AlertTriangle, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/admin-api";
import { placeInputSchema, type PlaceInput } from "@/lib/admin-types";
import { useAuth } from "@/lib/auth";
import { LAYER_LABEL, LAYERS, haversineKm, normalizeText } from "@/lib/places";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Category, PlaceLayer, PublishStatus } from "@/lib/types";
import { STATUS_LABEL } from "./places-table";

const CoordPicker = dynamic(() => import("./coord-picker"), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-lg bg-muted" />,
});

/** Giá trị form: số và JSON để dạng chuỗi cho dễ nhập, đổi sang PlaceInput khi lưu. */
type FormValues = {
  name: string;
  layer: PlaceLayer;
  lodging_type: "" | "hotel" | "homestay";
  primary_category_id: string;
  lat: string;
  lng: string;
  opening_hours: string;
  visit_duration_min: string;
  price_min_vnd: string;
  price_max_vnd: string;
  price_status: "estimated" | "confirmed" | "unknown";
  indoor: "" | "true" | "false";
  vegetarian_friendly: "" | "true" | "false";
  is_sponsored: boolean;
  address: string;
  ward: string;
  description: string;
  highlight_tags: string;
  image_url: string;
  source: string;
  updated_at: string;
};

type ServerPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  layer: PlaceLayer;
  lodging_type: "hotel" | "homestay" | null;
  primary_category_id: string;
  opening_hours: Record<string, string> | null;
  visit_duration_min: number | null;
  price_min_vnd: number | null;
  price_max_vnd: number | null;
  price_status: FormValues["price_status"];
  indoor: boolean | null;
  vegetarian_friendly: boolean | null;
  is_sponsored: boolean;
  address: string | null;
  ward: string | null;
  description: string | null;
  highlight_tags: string[];
  image_url: string | null;
  source: string;
  updated_at: string;
  publish_status: PublishStatus;
};

const EMPTY: FormValues = {
  name: "",
  layer: "heritage",
  lodging_type: "",
  primary_category_id: "",
  lat: "",
  lng: "",
  opening_hours: "",
  visit_duration_min: "",
  price_min_vnd: "",
  price_max_vnd: "",
  price_status: "unknown",
  indoor: "",
  vegetarian_friendly: "",
  is_sponsored: false,
  address: "",
  ward: "",
  description: "",
  highlight_tags: "",
  image_url: "",
  source: "",
  updated_at: "",
};

function fromServer(p: ServerPlace): FormValues {
  const s = (v: unknown) => (v == null ? "" : String(v));
  return {
    name: p.name,
    layer: p.layer,
    lodging_type: p.lodging_type ?? "",
    primary_category_id: p.primary_category_id,
    lat: s(p.lat),
    lng: s(p.lng),
    opening_hours: p.opening_hours ? JSON.stringify(p.opening_hours) : "",
    visit_duration_min: s(p.visit_duration_min),
    price_min_vnd: s(p.price_min_vnd),
    price_max_vnd: s(p.price_max_vnd),
    price_status: p.price_status,
    indoor: p.indoor == null ? "" : p.indoor ? "true" : "false",
    vegetarian_friendly: p.vegetarian_friendly == null ? "" : p.vegetarian_friendly ? "true" : "false",
    is_sponsored: p.is_sponsored,
    address: p.address ?? "",
    ward: p.ward ?? "",
    description: p.description ?? "",
    highlight_tags: p.highlight_tags.join(", "),
    image_url: p.image_url ?? "",
    source: p.source,
    updated_at: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(p.updated_at)),
  };
}

/** Đổi giá trị form sang PlaceInput; trả lỗi theo trường. */
function toInput(v: FormValues, status: PublishStatus): { data?: PlaceInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const num = (x: string) => (x.trim() === "" ? null : Number(x.replace(/[.\s]/g, "").replace(",", ".")));
  const bool = (x: string) => (x === "" ? null : x === "true");
  let hours: Record<string, string> | null = null;
  if (v.opening_hours.trim()) {
    try {
      hours = JSON.parse(v.opening_hours);
    } catch {
      errors.opening_hours = 'JSON không hợp lệ, ví dụ {"mon-sun":"07:00-17:30"}';
    }
  }
  const candidate = {
    name: v.name,
    layer: v.layer,
    lodging_type: v.layer === "stay" ? (v.lodging_type || null) : null,
    primary_category_id: v.primary_category_id,
    lat: v.lat.trim() === "" ? undefined : Number(v.lat),
    lng: v.lng.trim() === "" ? undefined : Number(v.lng),
    opening_hours: hours,
    visit_duration_min: num(v.visit_duration_min),
    price_min_vnd: num(v.price_min_vnd),
    price_max_vnd: num(v.price_max_vnd),
    price_status: v.price_status,
    indoor: bool(v.indoor),
    vegetarian_friendly: bool(v.vegetarian_friendly),
    is_sponsored: v.is_sponsored,
    address: v.address.trim() || null,
    ward: v.ward.trim() || null,
    description: v.description.trim() || null,
    highlight_tags: v.highlight_tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean),
    image_url: v.image_url.trim() || null,
    source: v.source.trim(),
    updated_at: v.updated_at,
    publish_status: status,
  };
  const parsed = placeInputSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
  }
  return Object.keys(errors).length ? { errors } : { data: parsed.data, errors };
}

export function PlaceForm({ placeId }: { placeId: string | null }) {
  const router = useRouter();
  const auth = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [others, setOthers] = useState<{ id: string; name: string; lat: number; lng: number }[]>([]);
  const [status, setStatus] = useState<PublishStatus>("draft");
  const [loaded, setLoaded] = useState(placeId == null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const { register, control, setValue, reset, getValues } = useForm<FormValues>({ defaultValues: EMPTY });
  const [layer, name, lat, lng] = useWatch({ control, name: ["layer", "name", "lat", "lng"] });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase
      .from("categories")
      .select("id, name, layer")
      .then(({ data }) => setCategories((data as Category[]) ?? []));
    api<{ places: { id: string; name: string; lat: number; lng: number }[] }>("/api/admin/places").then((d) =>
      setOthers(d.places),
    );
    if (placeId) {
      api<{ place: ServerPlace }>(`/api/admin/places/${placeId}`)
        .then((d) => {
          reset(fromServer(d.place));
          setStatus(d.place.publish_status);
          setLoaded(true);
        })
        .catch((e: ApiError) => toast.error(e.message));
    }
  }, [placeId, reset]);

  useEffect(() => {
    if (auth.status !== "signed_in") return;
    getSupabaseBrowserClient()
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle()
      .then(({ data }) => setIsAdmin(data?.role === "admin"));
  }, [auth]);

  // AC-SUP-03: trùng tên (bỏ dấu) trong bán kính 100 m.
  const duplicate = useMemo(() => {
    const la = Number(lat);
    const ln = Number(lng);
    if (!name.trim() || !Number.isFinite(la) || !Number.isFinite(ln) || lat === "" || lng === "") return null;
    const n = normalizeText(name.trim());
    return (
      others.find(
        (o) => o.id !== placeId && normalizeText(o.name) === n && haversineKm({ lat: la, lng: ln }, o) <= 0.1,
      ) ?? null
    );
  }, [name, lat, lng, others, placeId]);

  async function save(next: PublishStatus) {
    const { data, errors } = toInput(getValues(), next);
    setFieldErrors(errors);
    if (!data) {
      toast.error(
        next === "published" && (errors.source || errors.updated_at)
          ? "Thiếu nguồn hoặc ngày cập nhật: chưa thể xuất bản, bạn vẫn có thể Lưu nháp."
          : "Vui lòng sửa các trường được đánh dấu.",
      );
      return;
    }
    setBusy(true);
    try {
      if (placeId) {
        await api(`/api/admin/places/${placeId}`, { method: "PATCH", body: JSON.stringify(data) });
        setStatus(next);
        toast.success(`Đã lưu (${STATUS_LABEL[next]})`);
      } else {
        const res = await api<{ id: string }>("/api/admin/places", { method: "POST", body: JSON.stringify(data) });
        toast.success(`Đã thêm (${STATUS_LABEL[next]})`);
        router.replace(`/admin/places/${res.id}`);
      }
    } catch (e) {
      const err = e as ApiError;
      toast.error(`${err.message}${err.requestId ? ` (mã ${err.requestId.slice(0, 8)})` : ""}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!placeId) return;
    setBusy(true);
    try {
      await api(`/api/admin/places/${placeId}`, { method: "DELETE" });
      toast.success("Đã xóa vĩnh viễn");
      router.replace("/admin/places");
    } catch (e) {
      toast.error((e as ApiError).message);
      setBusy(false);
    }
  }

  if (!loaded) return <p className="text-sm text-muted-foreground">Đang tải…</p>;

  const cats = categories.filter((c) => c.layer === layer);
  const err = (k: keyof FormValues) =>
    fieldErrors[k] ? <p className="mt-1 text-xs font-medium text-destructive">{fieldErrors[k]}</p> : null;
  const box = (k: keyof FormValues) => cn("h-9", fieldErrors[k] && "border-destructive ring-1 ring-destructive");

  return (
    <div className="max-w-5xl space-y-5">
      <Link href="/admin/places" className="flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Danh sách địa điểm
      </Link>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{placeId ? "Sửa địa điểm" : "Thêm địa điểm"}</h1>
        {placeId && <span className="rounded bg-muted px-2 py-0.5 text-xs">{STATUS_LABEL[status]}</span>}
      </div>

      {duplicate && (
        <p className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          Đã có địa điểm cùng tên trong bán kính 100 m:{" "}
          <Link href={`/admin/places/${duplicate.id}`} className="font-medium underline">
            {duplicate.name}
          </Link>
          . Kiểm tra để tránh nhập trùng.
        </p>
      )}

      <div className="grid grid-cols-2 gap-6">
        <section className="space-y-3">
          <Field label="Tên *">
            <Input {...register("name")} className={box("name")} />
            {err("name")}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lớp *">
              <select {...register("layer")} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                {LAYERS.map((l) => (
                  <option key={l} value={l}>
                    {LAYER_LABEL[l]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Danh mục *">
              <select
                {...register("primary_category_id")}
                className={cn("h-9 w-full rounded-md border bg-background px-2 text-sm", fieldErrors.primary_category_id && "border-destructive")}
              >
                <option value="">— Chọn —</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {err("primary_category_id")}
            </Field>
          </div>
          {layer === "stay" && (
            <Field label="Loại hình lưu trú *">
              <select {...register("lodging_type")} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                <option value="">— Chọn —</option>
                <option value="hotel">Khách sạn</option>
                <option value="homestay">Homestay</option>
              </select>
              {err("lodging_type")}
            </Field>
          )}

          <Field label='Giờ mở cửa (JSON, ví dụ {"mon-sun":"07:00-17:30"}; để trống nếu chưa rõ)'>
            <Input {...register("opening_hours")} className={cn(box("opening_hours"), "font-mono text-xs")} />
            {err("opening_hours")}
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Giá thấp nhất (đ)">
              <Input {...register("price_min_vnd")} inputMode="numeric" className={box("price_min_vnd")} />
              {err("price_min_vnd")}
            </Field>
            <Field label="Giá cao nhất (đ)">
              <Input {...register("price_max_vnd")} inputMode="numeric" className={box("price_max_vnd")} />
              {err("price_max_vnd")}
            </Field>
            <Field label="Trạng thái giá">
              <select {...register("price_status")} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                <option value="estimated">Giá tham khảo</option>
                <option value="confirmed">Đã xác nhận</option>
                <option value="unknown">Không xác định</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Thời gian tham quan (phút)">
              <Input {...register("visit_duration_min")} inputMode="numeric" className={box("visit_duration_min")} />
              {err("visit_duration_min")}
            </Field>
            <Field label="Trong nhà / ngoài trời">
              <select {...register("indoor")} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                <option value="">Chưa rõ</option>
                <option value="true">Trong nhà</option>
                <option value="false">Ngoài trời</option>
              </select>
            </Field>
            <Field label="Có món chay">
              <select {...register("vegetarian_friendly")} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                <option value="">Chưa rõ</option>
                <option value="true">Có</option>
                <option value="false">Không</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Địa chỉ">
              <Input {...register("address")} className="h-9" />
            </Field>
            <Field label="Phường/xã">
              <Input {...register("ward")} className="h-9" />
            </Field>
          </div>
          <Field label="Mô tả ngắn (dùng làm nguyên liệu cho lý do 'Hợp với bạn')">
            <textarea {...register("description")} rows={3} className="w-full rounded-md border bg-background p-2 text-sm" />
          </Field>
          <Field label="Thẻ nổi bật (phân cách dấu phẩy: architecture, photo_spot, sunset, local_food, nightlife, nature…)">
            <Input {...register("highlight_tags")} className="h-9" />
          </Field>
          <Field label="Link ảnh">
            <Input {...register("image_url")} className={box("image_url")} />
            {err("image_url")}
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("is_sponsored")} />
            Nội dung tài trợ / đối tác (BR-MAP-05: hiển thị nhãn, không cộng điểm xếp hạng)
          </label>
        </section>

        <section className="space-y-3">
          <Field label="Tọa độ * (bấm lên bản đồ hoặc kéo ghim)">
            <CoordPicker
              lat={lat === "" ? null : Number(lat)}
              lng={lng === "" ? null : Number(lng)}
              onChange={(la, ln) => {
                setValue("lat", String(la));
                setValue("lng", String(ln));
              }}
            />
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Input {...register("lat")} placeholder="Vĩ độ (vd 16.4698)" className={box("lat")} />
              <Input {...register("lng")} placeholder="Kinh độ (vd 107.5786)" className={box("lng")} />
            </div>
            {err("lat")}
            {err("lng")}
          </Field>

          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-semibold">Nguồn dữ liệu (BR-SOURCE-01) – bắt buộc khi xuất bản</p>
            <Field label="Nguồn (tên trang chính thức, link fanpage, ‘khảo sát tại chỗ’…)">
              <Input {...register("source")} className={box("source")} />
              {err("source")}
            </Field>
            <Field label="Ngày kiểm tra dữ liệu">
              <Input type="date" {...register("updated_at")} className={box("updated_at")} />
              {err("updated_at")}
            </Field>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" disabled={busy} onClick={() => save("draft")}>
              Lưu nháp
            </Button>
            <Button disabled={busy} onClick={() => save("published")}>
              Xuất bản
            </Button>
            {placeId && (
              <Button variant="outline" disabled={busy} onClick={() => save("hidden")}>
                Ẩn khỏi bản đồ
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Nháp và Ẩn không hiện trên Hue Map (AC-ADM-03). Mọi thao tác được ghi vào nhật ký.
          </p>

          {placeId && isAdmin && (
            <div className="mt-4 rounded-lg border border-destructive/40 p-3">
              {!confirmDelete ? (
                <Button variant="destructive" disabled={busy} onClick={() => setConfirmDelete(true)}>
                  <Trash2 data-icon="inline-start" />
                  Xóa vĩnh viễn
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm">
                    Xóa vĩnh viễn không khôi phục được. Nếu chỉ muốn tạm gỡ khỏi bản đồ, hãy dùng <b>Ẩn</b>. Xác nhận xóa?
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                      Hủy
                    </Button>
                    <Button variant="destructive" disabled={busy} onClick={remove}>
                      Xác nhận xóa vĩnh viễn
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
