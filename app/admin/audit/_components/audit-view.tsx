"use client";

// UX-A5: nhật ký thao tác, lọc theo người thực hiện và ngày (FR-ADM-06).
// Mỗi dòng có người thực hiện, thời điểm, đối tượng, giá trị trước/sau (AC-ROLE-04, AC-SUP-01).

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/admin-api";

type Log = {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  at: string;
};

const ACTION_LABEL: Record<string, string> = {
  create: "Tạo",
  update: "Sửa",
  publish: "Xuất bản",
  hide: "Ẩn",
  delete: "Xóa",
  role_change: "Đổi vai trò",
};

const ACTION_TONE: Record<string, string> = {
  create: "bg-sky-100 text-sky-900",
  update: "bg-muted",
  publish: "bg-emerald-100 text-emerald-900",
  hide: "bg-neutral-200",
  delete: "bg-destructive/15 text-destructive",
  role_change: "bg-violet-100 text-violet-900",
};

/** Bỏ qua các trường kỹ thuật khi so sánh trước/sau. */
const IGNORED = new Set(["location", "created_at"]);

function changes(before: Log["before"], after: Log["after"]) {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...keys]
    .filter((k) => !IGNORED.has(k) && JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]))
    .map((k) => ({ k, from: before?.[k], to: after?.[k] }));
}

const show = (v: unknown) => (v == null ? "∅" : typeof v === "object" ? JSON.stringify(v) : String(v));

export function AuditView() {
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actors, setActors] = useState<{ id: string; email: string }[]>([]);
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    api<{ users: { id: string; email: string }[] }>("/api/admin/users")
      .then((d) => setActors(d.users))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams();
    if (actor) sp.set("actor", actor);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    let alive = true;
    api<{ logs: Log[] }>(`/api/admin/audit-logs?${sp.toString()}`)
      .then((d) => alive && (setLogs(d.logs), setError(null)))
      .catch((e: ApiError) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [actor, from, to]);

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Nhật ký thao tác</h1>
        <p className="text-sm text-muted-foreground">
          Ghi tự động bởi cơ sở dữ liệu khi thêm, sửa, xuất bản, ẩn, xóa địa điểm hoặc đổi vai trò. Không sửa hay xóa được.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label>
          <span className="mb-1 block text-xs text-muted-foreground">Người thực hiện</span>
          <select value={actor} onChange={(e) => setActor(e.target.value)} className="h-9 rounded-md border bg-background px-2">
            <option value="">Tất cả</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.email}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs text-muted-foreground">Từ ngày</span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
        </label>
        <label>
          <span className="mb-1 block text-xs text-muted-foreground">Đến ngày</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
        </label>
      </div>
      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Thời điểm</th>
              <th className="px-3 py-2">Người thực hiện</th>
              <th className="px-3 py-2">Thao tác</th>
              <th className="px-3 py-2">Đối tượng</th>
              <th className="px-3 py-2">Thay đổi (trước → sau)</th>
            </tr>
          </thead>
          <tbody>
            {logs?.map((l) => {
              const diff = changes(l.before, l.after);
              const name = (l.after?.name ?? l.before?.name) as string | undefined;
              return (
                <tr key={l.id} className="border-t align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {new Date(l.at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                  </td>
                  <td className="px-3 py-2">{l.actor_email ?? (l.actor_id ? l.actor_id.slice(0, 8) : "Hệ thống / SQL Editor")}</td>
                  <td className="px-3 py-2">
                    <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", ACTION_TONE[l.action])}>
                      {ACTION_LABEL[l.action] ?? l.action}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {l.entity === "places" && l.entity_id && l.action !== "delete" ? (
                      <Link href={`/admin/places/${l.entity_id}`} className="hover:underline">
                        {name ?? l.entity_id.slice(0, 8)}
                      </Link>
                    ) : (
                      (name ?? `${l.entity} ${l.entity_id?.slice(0, 8) ?? ""}`)
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {l.action === "create" ? (
                      <span className="text-muted-foreground">Tạo mới</span>
                    ) : l.action === "delete" ? (
                      <span className="text-muted-foreground">Đã xóa bản ghi</span>
                    ) : diff.length === 0 ? (
                      <span className="text-muted-foreground">Không đổi giá trị</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {diff.slice(0, 6).map((d) => (
                          <li key={d.k} className="break-all">
                            <b>{d.k}</b>: <span className="text-destructive line-through">{show(d.from)}</span> →{" "}
                            <span className="text-emerald-700">{show(d.to)}</span>
                          </li>
                        ))}
                        {diff.length > 6 && <li className="text-muted-foreground">… và {diff.length - 6} trường khác</li>}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
            {logs && logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  Không có thao tác nào trong khoảng đã chọn.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
