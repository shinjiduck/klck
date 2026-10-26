"use client";

// UC-15 (GĐ1 cơ bản): xem sổ ghi nhận đồng ý của chính mình, rút lại / cấp lại đồng ý lưu sở thích.
// PR-01: mỗi bản ghi có mục đích, loại dữ liệu, phiên bản chính sách, trạng thái, thời điểm, bằng chứng.
// Rút lại "personalization" → xóa sở thích đã lưu trên server (tối thiểu hóa dữ liệu, BR-PREF-02);
// sở thích trên máy vẫn dùng được cho bản nháp. RLS: chỉ đọc/ghi đồng ý của chính mình.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AccountButton } from "@/components/account-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const POLICY_VERSION = "2026-10";

type Consent = {
  id: string;
  purpose: string;
  data_categories: string[];
  policy_version: string;
  status: "granted" | "withdrawn";
  granted_at: string | null;
  withdrawn_at: string | null;
};

const PURPOSE: Record<string, { title: string; text: string; required?: boolean }> = {
  account: {
    title: "Tài khoản và chuyến đi",
    text: "Lưu email và các chuyến đi để bạn mở lại trên thiết bị khác. Bắt buộc khi có tài khoản.",
    required: true,
  },
  personalization: {
    title: "Lưu sở thích",
    text: "Lưu sở thích, đi cùng ai, chế độ ăn vào tài khoản để gợi ý phù hợp hơn.",
  },
};

const CATEGORY: Record<string, string> = {
  email: "email",
  trips: "chuyến đi",
  preferences: "sở thích",
  travel_with: "đi cùng ai",
  dietary: "chế độ ăn",
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }) : "—";

export function PrivacyView() {
  const auth = useAuth();
  const [consents, setConsents] = useState<Consent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const userId = auth.status === "signed_in" ? auth.user.id : null;

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    getSupabaseBrowserClient()
      .from("consents")
      .select("id, purpose, data_categories, policy_version, status, granted_at, withdrawn_at")
      .order("granted_at", { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) toast.error("Không tải được sổ đồng ý");
        setConsents((data as Consent[]) ?? []);
      });
    return () => {
      alive = false;
    };
  }, [userId, reloadKey]);

  if (auth.status === "disabled") {
    return <Centered>Chế độ dữ liệu giả: chưa có tài khoản nên không lưu dữ liệu cá nhân nào lên server.</Centered>;
  }
  if (auth.status === "loading") return null;
  if (auth.status === "signed_out") {
    return (
      <Centered>
        <p>Đăng nhập để xem và quản lý các đồng ý của bạn.</p>
        <AccountButton />
      </Centered>
    );
  }

  const active = (purpose: string) => consents?.find((c) => c.purpose === purpose && c.status === "granted");
  const personal = active("personalization");

  async function withdraw(c: Consent) {
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("consents")
      .update({ status: "withdrawn", withdrawn_at: new Date().toISOString() })
      .eq("id", c.id);
    if (!error) await supabase.from("user_preferences").delete().eq("user_id", userId!);
    setBusy(false);
    if (error) toast.error("Không rút lại được, thử lại sau.");
    else toast.success("Đã rút lại đồng ý và xóa sở thích đã lưu trên tài khoản");
    load();
  }

  async function grant() {
    setBusy(true);
    const { error } = await getSupabaseBrowserClient().from("consents").insert({
      purpose: "personalization",
      data_categories: ["preferences", "travel_with", "dietary"],
      policy_version: POLICY_VERSION,
      status: "granted",
      granted_at: new Date().toISOString(),
      evidence: { source: "privacy_page", ui_text: PURPOSE.personalization.text, client_at: new Date().toISOString() },
    });
    setBusy(false);
    if (error) toast.error("Không lưu được, thử lại sau.");
    else toast.success("Đã đồng ý lưu sở thích. Lần lưu chuyến đi tới sẽ lưu kèm sở thích.");
    load();
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-4 px-4 pt-5 pb-8">
        <Link href="/trip" className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Lịch của tôi
        </Link>
        <header className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ShieldCheck className="size-5" aria-hidden />
            Quyền riêng tư
          </h1>
          <AccountButton />
          <p className="text-sm text-muted-foreground">
            HueTrip chỉ xin vị trí khi bạn bấm &ldquo;Vị trí của tôi&rdquo; và không lưu lịch sử vị trí. Dưới đây là các đồng ý
            bạn đã cấp (chính sách phiên bản {POLICY_VERSION}).
          </p>
        </header>

        {(["account", "personalization"] as const).map((p) => {
          const c = active(p);
          return (
            <section key={p} className="space-y-2 rounded-xl border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">{PURPOSE[p].title}</h2>
                  <p className="text-xs text-muted-foreground">{PURPOSE[p].text}</p>
                </div>
                <span
                  className={
                    c
                      ? "rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-900"
                      : "rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
                  }
                >
                  {c ? "Đang đồng ý" : "Chưa đồng ý"}
                </span>
              </div>
              {c && (
                <p className="text-[11px] text-muted-foreground">
                  Dữ liệu: {c.data_categories.map((d) => CATEGORY[d] ?? d).join(", ")} · Đồng ý lúc {fmt(c.granted_at)}
                </p>
              )}
              {p === "personalization" &&
                (personal ? (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => withdraw(personal)}>
                    Rút lại đồng ý
                  </Button>
                ) : (
                  <Button size="sm" disabled={busy} onClick={grant}>
                    Đồng ý lưu sở thích
                  </Button>
                ))}
              {PURPOSE[p].required && (
                <p className="text-[11px] text-muted-foreground">
                  Muốn rút lại mục này nghĩa là xóa tài khoản – chức năng xuất và xóa dữ liệu sẽ có ở giai đoạn sau.
                </p>
              )}
            </section>
          );
        })}

        {consents && consents.some((c) => c.status === "withdrawn") && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Lịch sử đồng ý</summary>
            <ul className="mt-2 space-y-1">
              {consents.map((c) => (
                <li key={c.id}>
                  {PURPOSE[c.purpose]?.title ?? c.purpose}: {c.status === "granted" ? "đồng ý" : "đã rút lại"} · cấp{" "}
                  {fmt(c.granted_at)}
                  {c.withdrawn_at && ` · rút ${fmt(c.withdrawn_at)}`}
                </li>
              ))}
            </ul>
          </details>
        )}

        <Link href="/map" className={buttonVariants({ variant: "ghost", className: "w-full" })}>
          Về bản đồ
        </Link>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-sm">{children}</div>;
}
