"use client";

// UX-A4: danh sách tài khoản, đổi vai trò (chỉ admin). Không tự đổi vai trò của chính mình (SEC-ROLE-06).
// GĐ1 dùng 3 vai trò: Du khách, Quản trị viên (và Khách = chưa đăng nhập); Biên tập viên/Đối tác chuẩn bị cho GĐ2.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ApiError, api } from "@/lib/admin-api";
import { ROLE_LABEL, type AppRole } from "@/lib/admin-types";

type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  role: AppRole;
  created_at: string;
  last_sign_in_at: string | null;
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }) : "—";

export function UsersView() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ users: UserRow[]; me: string }>("/api/admin/users")
      .then((d) => {
        setUsers(d.users);
        setMe(d.me);
      })
      .catch((e: ApiError) => setError(e.message));
  }, []);

  async function changeRole(u: UserRow, role: AppRole) {
    if (role === u.role) return;
    try {
      await api(`/api/admin/users/${u.id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
      setUsers((list) => list?.map((x) => (x.id === u.id ? { ...x, role } : x)) ?? null);
      toast.success(`Đã đổi ${u.email} thành ${ROLE_LABEL[role]}`);
    } catch (e) {
      toast.error((e as ApiError).message);
    }
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Người dùng và vai trò</h1>
        <p className="text-sm text-muted-foreground">
          Chỉ quản trị viên đổi được vai trò; không ai tự đổi vai trò của chính mình. Mọi thay đổi được ghi nhật ký.
        </p>
      </div>
      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Tên hiển thị</th>
              <th className="px-3 py-2">Vai trò</th>
              <th className="px-3 py-2">Tạo lúc</th>
              <th className="px-3 py-2">Đăng nhập gần nhất</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-3 py-2 font-medium">
                  {u.email}
                  {u.id === me && <span className="ml-2 text-xs text-muted-foreground">(bạn)</span>}
                </td>
                <td className="px-3 py-2">{u.display_name ?? "—"}</td>
                <td className="px-3 py-2">
                  <select
                    value={u.role}
                    disabled={u.id === me}
                    title={u.id === me ? "Không thể tự đổi vai trò của chính mình" : undefined}
                    onChange={(e) => changeRole(u, e.target.value as AppRole)}
                    className="h-8 rounded-md border bg-background px-2 text-sm disabled:opacity-60"
                  >
                    {(Object.keys(ROLE_LABEL) as AppRole[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{fmt(u.created_at)}</td>
                <td className="px-3 py-2 text-muted-foreground">{fmt(u.last_sign_in_at)}</td>
              </tr>
            ))}
            {users && users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  Chưa có tài khoản.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
