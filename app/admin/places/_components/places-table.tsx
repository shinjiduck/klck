"use client";

// UX-A1 Danh sách địa điểm (mọi trạng thái).
// FR-ADM-01: tìm theo tên, lọc theo lớp, trạng thái xuất bản, "quá hạn cập nhật"; hiển thị ngày cập nhật và nguồn.
// AC-SUP-04: quá 90 ngày chưa cập nhật → gắn cờ "Cần kiểm tra".

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, RefreshCw } from "lucide-react";
import { cn } from "cn";
import { KindIcon, placeKind } from "@/components/layer-icon";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/admin-api";
import { STALE_DAYS, isStale } from "@/lib/admin-types";
import { LAYER_LABEL, LAYERS, formatUpdatedMonth, normalizeText } from "@/lib/places";
import type { PlaceLayer, PublishStatus } from "@/lib/types";

type Row = {
  id: string;
  slug: string;
  name: string;
  layer: PlaceLayer;
  lodging_type: "hotel" | "homestay" | null;
  publish_status: PublishStatus;
  source: string;
  updated_at: string;
};

export const STATUS_LABEL: Record<PublishStatus, string> = {
  draft: "Nháp",
  pending: "Chờ duyệt",
  published: "Đã xuất bản",
  hidden: "Đã ẩn",
};

const STATUS_TONE: Record<PublishStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-amber-100 text-amber-900",
  published: "bg-emerald-100 text-emerald-900",
  hidden: "bg-neutral-200 text-neutral-700",
};

export function PlacesTable() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [layer, setLayer] = useState<PlaceLayer | "">("");
  const [status, setStatus] = useState<PublishStatus | "">("");
  const [staleOnly, setStaleOnly] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    api<{ places: Row[] }>("/api/admin/places")
      .then((d) => alive && (setRows(d.places), setError(null)))
      .catch((e: ApiError) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const nq = normalizeText(q.trim());
    return rows.filter(
      (r) =>
        (!nq || normalizeText(r.name).includes(nq)) &&
        (!layer || r.layer === layer) &&
        (!status || r.publish_status === status) &&
        (!staleOnly || isStale(r.updated_at)),
    );
  }, [rows, q, layer, status, staleOnly]);

  const staleCount = rows?.filter((r) => isStale(r.updated_at)).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Địa điểm</h1>
          <p className="text-sm text-muted-foreground">
            {rows ? `${rows.length} địa điểm · ${staleCount} cần kiểm tra (quá ${STALE_DAYS} ngày chưa cập nhật)` : "Đang tải…"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className={buttonVariants({ variant: "outline" })}
          >
            <RefreshCw data-icon="inline-start" />
            Tải lại
          </button>
          <Link href="/admin/places/new" className={buttonVariants()}>
            <Plus data-icon="inline-start" />
            Thêm địa điểm
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên…"
          aria-label="Tìm theo tên"
          className="h-9 w-64"
        />
        <select
          value={layer}
          onChange={(e) => setLayer(e.target.value as PlaceLayer | "")}
          aria-label="Lọc theo lớp"
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">Mọi lớp</option>
          {LAYERS.map((l) => (
            <option key={l} value={l}>
              {LAYER_LABEL[l]}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as PublishStatus | "")}
          aria-label="Lọc theo trạng thái"
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">Mọi trạng thái</option>
          {(Object.keys(STATUS_LABEL) as PublishStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={staleOnly} onChange={(e) => setStaleOnly(e.target.checked)} />
          Chỉ hiện quá hạn cập nhật
        </label>
      </div>

      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Tên</th>
              <th className="px-3 py-2 font-medium">Lớp</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
              <th className="px-3 py-2 font-medium">Nguồn</th>
              <th className="px-3 py-2 font-medium">Cập nhật</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const stale = isStale(r.updated_at);
              return (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Link href={`/admin/places/${r.id}`} className="flex items-center gap-2 font-medium hover:underline">
                      <KindIcon kind={placeKind(r)} className="text-muted-foreground" />
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{LAYER_LABEL[r.layer]}</td>
                  <td className="px-3 py-2">
                    <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", STATUS_TONE[r.publish_status])}>
                      {STATUS_LABEL[r.publish_status]}
                    </span>
                  </td>
                  <td className="max-w-64 truncate px-3 py-2 text-muted-foreground" title={r.source}>
                    {r.source || "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatUpdatedMonth(r.updated_at)}
                    {stale && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                        <AlertTriangle className="size-3" aria-hidden />
                        Cần kiểm tra
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Không có địa điểm khớp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
