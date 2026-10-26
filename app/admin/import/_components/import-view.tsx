"use client";

// UX-A3 Nhập hàng loạt từ CSV theo mẫu (FR-ADM-04).
// AC-ADM-02: liệt kê số dòng lỗi (ví dụ tọa độ sai định dạng) TRƯỚC khi lưu; dòng lỗi không được lưu.
// Dòng cùng tên (slug) với địa điểm đã có sẽ cập nhật địa điểm đó.

import { useState } from "react";
import { CheckCircle2, Download, FileUp, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/admin-api";
import { CSV_COLUMNS, CSV_TEMPLATE, csvToPlaces, type CsvRowResult } from "@/lib/csv-import";
import { LAYER_LABEL } from "@/lib/places";

export function ImportView() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvRowResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ saved: number; failed: number } | null>(null);

  const valid = rows.filter((r) => r.data);
  const invalid = rows.filter((r) => !r.data);

  async function onFile(file: File) {
    setDone(null);
    setFileName(file.name);
    const result = csvToPlaces(await file.text());
    setMissing(result.missing);
    setRows(result.rows);
  }

  function downloadTemplate() {
    const blob = new Blob(["﻿" + CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "huetrip-places-mau.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function submit() {
    setBusy(true);
    try {
      const res = await api<{ saved: number; failed: number; results: { line: number; ok: boolean; message?: string }[] }>(
        "/api/admin/places/import",
        { method: "POST", body: JSON.stringify({ rows: valid.map((r) => ({ line: r.line, data: r.data })) }) },
      );
      setDone({ saved: res.saved, failed: res.failed });
      toast.success(`Đã lưu ${res.saved} địa điểm`);
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Nhập CSV</h1>
        <p className="text-sm text-muted-foreground">
          Nhập nhiều địa điểm cùng lúc. Hệ thống kiểm tra từng dòng và chỉ lưu các dòng hợp lệ. Mặc định trạng thái là{" "}
          <b>Nháp</b> (không hiện trên bản đồ) nếu cột publish_status để trống.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
          <FileUp className="size-4" aria-hidden />
          Chọn file CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
        <Button variant="outline" onClick={downloadTemplate}>
          <Download data-icon="inline-start" />
          Tải file mẫu
        </Button>
        {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
      </div>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Các cột hỗ trợ</summary>
        <p className="mt-1 font-mono">{CSV_COLUMNS.join(", ")}</p>
        <p className="mt-1">
          opening_hours là JSON (ví dụ {'{"mon-sun":"07:00-17:30"}'}), highlight_tags phân cách bằng dấu chấm phẩy, updated_at dạng
          YYYY-MM-DD. Thiếu cột category thì dùng danh mục mặc định theo lớp.
        </p>
      </details>

      {missing.length > 0 && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          File thiếu cột bắt buộc: <b>{missing.join(", ")}</b>. Hãy dùng file mẫu.
        </p>
      )}

      {rows.length > 0 && missing.length === 0 && (
        <>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="size-4" aria-hidden />
              {valid.length} dòng hợp lệ
            </span>
            <span className="flex items-center gap-1 text-destructive">
              <XCircle className="size-4" aria-hidden />
              {invalid.length} dòng lỗi (sẽ không lưu)
            </span>
          </div>

          {invalid.length > 0 && (
            <div className="rounded-lg border border-destructive/30">
              <p className="border-b bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive">Dòng lỗi</p>
              <ul className="divide-y text-sm">
                {invalid.map((r) => (
                  <li key={r.line} className="px-3 py-2">
                    <b>Dòng {r.line}</b>
                    {r.name && ` – ${r.name}`}: {r.errors.join("; ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {valid.length > 0 && (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Dòng</th>
                    <th className="px-3 py-2">Tên</th>
                    <th className="px-3 py-2">Lớp</th>
                    <th className="px-3 py-2">Tọa độ</th>
                    <th className="px-3 py-2">Nguồn</th>
                    <th className="px-3 py-2">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {valid.map((r) => (
                    <tr key={r.line} className="border-t">
                      <td className="px-3 py-2">{r.line}</td>
                      <td className="px-3 py-2 font-medium">{r.data!.name}</td>
                      <td className="px-3 py-2">{LAYER_LABEL[r.data!.layer]}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {r.data!.lat}, {r.data!.lng}
                      </td>
                      <td className="max-w-56 truncate px-3 py-2 text-muted-foreground">{r.data!.source || "—"}</td>
                      <td className="px-3 py-2">{r.data!.publish_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Button disabled={busy || valid.length === 0} onClick={submit}>
            {busy ? "Đang lưu…" : `Lưu ${valid.length} dòng hợp lệ`}
          </Button>
          {done && (
            <p className="text-sm text-emerald-700">
              Đã lưu {done.saved} địa điểm{done.failed ? `, server từ chối ${done.failed} dòng` : ""}. Xem ở mục Địa điểm.
            </p>
          )}
        </>
      )}
    </div>
  );
}
