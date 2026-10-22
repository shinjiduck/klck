"use client";

// UX-08 Đăng nhập / đăng ký (Supabase Auth, email + mật khẩu).
// PR-01: đồng ý được ghi vào sổ consents ngay khi tạo tài khoản (trigger handle_new_user), mỗi mục
// có mục đích, loại dữ liệu, phiên bản chính sách, thời điểm và câu chữ người dùng đã thấy.
// Mục "personalization" là tùy chọn: không đồng ý thì sở thích chỉ nằm trên máy, không lưu lên server.
// AC-F8.3-01: sau khi đăng nhập quay về đúng trang (?next=), trang đó tiếp tục hành động đang chờ.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { MailCheck, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeNext, useAuth } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { zodResolver } from "@/lib/zod-resolver";

export const POLICY_VERSION = "2026-10";

const CONSENT_ACCOUNT =
  "Tôi đồng ý để HueTrip lưu email và các chuyến đi của tôi nhằm cung cấp chức năng lưu lịch trình.";
const CONSENT_PERSONALIZATION =
  "Cho phép lưu sở thích (sở thích, đi cùng ai, chế độ ăn) vào tài khoản để gợi ý phù hợp hơn. Có thể rút lại.";

type Mode = "signin" | "signup";

type Values = {
  email: string;
  password: string;
  display_name: string;
  consent_account: boolean;
  consent_personalization: boolean;
};

function schemaFor(mode: Mode) {
  return z
    .object({
      email: z.string().trim().email("Email không hợp lệ."),
      password: z.string().min(mode === "signup" ? 8 : 1, mode === "signup" ? "Mật khẩu ít nhất 8 ký tự." : "Nhập mật khẩu."),
      display_name: z.string().trim().max(60, "Tối đa 60 ký tự."),
      consent_account: z.boolean(),
      consent_personalization: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (mode === "signup" && !v.consent_account) {
        ctx.addIssue({ code: "custom", path: ["consent_account"], message: "Cần đồng ý để tạo tài khoản và lưu chuyến đi." });
      }
    });
}

/** Thông báo lỗi Supabase Auth bằng tiếng Việt. */
function viError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email hoặc mật khẩu không đúng.";
  if (m.includes("email not confirmed")) return "Email chưa được xác nhận. Hãy mở thư xác nhận trong hộp thư của bạn.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Email này đã có tài khoản. Hãy đăng nhập.";
  if (m.includes("rate limit") || m.includes("too many")) return "Bạn thao tác quá nhanh. Thử lại sau ít phút.";
  if (m.includes("password")) return "Mật khẩu chưa đủ mạnh. Dùng ít nhất 8 ký tự, có chữ và số.";
  return "Không thực hiện được. Thử lại sau.";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [serverError, setServerError] = useState<string | null>(
    params.get("error") === "link" ? "Link xác nhận đã hết hạn hoặc không hợp lệ. Hãy đăng nhập lại." : null,
  );
  const [checkEmail, setCheckEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: (values, ctx, opts) => zodResolver(schemaFor(mode) as z.ZodType<Values>)(values, ctx, opts),
    defaultValues: { email: "", password: "", display_name: "", consent_account: false, consent_personalization: false },
  });

  // Đã đăng nhập (vừa xong hoặc mở lại trang) → quay về trang đang làm.
  useEffect(() => {
    if (auth.status === "signed_in") router.replace(next);
  }, [auth.status, next, router]);

  if (!isSupabaseConfigured) {
    return (
      <Centered>
        <p className="font-medium">Đăng nhập chưa được cấu hình</p>
        <p className="text-sm text-muted-foreground">
          Thêm NEXT_PUBLIC_SUPABASE_URL và khóa công khai vào .env.local. Trong lúc đó bạn vẫn dùng được bản nháp trên máy.
        </p>
      </Centered>
    );
  }

  if (checkEmail) {
    return (
      <Centered>
        <MailCheck className="size-10 text-emerald-600" aria-hidden />
        <p className="font-medium">Kiểm tra hộp thư của bạn</p>
        <p className="text-sm text-muted-foreground">
          HueTrip đã gửi thư xác nhận tới <b>{checkEmail}</b>. Bấm link trong thư để kích hoạt tài khoản, bạn sẽ được đưa về
          đúng trang đang làm.
        </p>
        <Button variant="outline" onClick={() => setCheckEmail(null)}>
          Quay lại đăng nhập
        </Button>
      </Centered>
    );
  }

  const onSubmit = async (v: Values) => {
    setServerError(null);
    const supabase = getSupabaseBrowserClient();
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email: v.email, password: v.password });
      if (error) setServerError(viError(error.message));
      return; // useEffect phía trên chuyển trang khi trạng thái thành signed_in
    }

    const at = new Date().toISOString();
    const consents = [
      { purpose: "account", data_categories: ["email", "trips"], policy_version: POLICY_VERSION, ui_text: CONSENT_ACCOUNT, client_at: at },
      ...(v.consent_personalization
        ? [
            {
              purpose: "personalization",
              data_categories: ["preferences", "travel_with", "dietary"],
              policy_version: POLICY_VERSION,
              ui_text: CONSENT_PERSONALIZATION,
              client_at: at,
            },
          ]
        : []),
    ];
    const { data, error } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        data: { display_name: v.display_name || undefined, consents },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) setServerError(viError(error.message));
    else if (!data.session) setCheckEmail(v.email); // dự án bật "Confirm email"
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="h-full overflow-y-auto">
      <div className="space-y-5 px-4 pt-6 pb-8">
        <header>
          <h1 className="text-xl font-semibold">{mode === "signin" ? "Đăng nhập" : "Tạo tài khoản"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Lưu lịch trình, thêm điểm từ bản đồ và mở lại trên máy khác.</p>
        </header>

        <div role="tablist" className="grid grid-cols-2 rounded-lg bg-muted p-1 text-sm font-medium">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setServerError(null);
              }}
              className={cn("rounded-md py-1.5", mode === m ? "bg-background shadow-sm" : "text-muted-foreground")}
            >
              {m === "signin" ? "Đăng nhập" : "Tạo tài khoản"}
            </button>
          ))}
        </div>

        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" className="h-10" {...register("email")} />
        </Field>
        <Field label="Mật khẩu" error={errors.password?.message}>
          <Input
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            className="h-10"
            {...register("password")}
          />
        </Field>

        {mode === "signup" && (
          <>
            <Field label="Tên hiển thị (không bắt buộc)" error={errors.display_name?.message}>
              <Input autoComplete="nickname" className="h-10" {...register("display_name")} />
            </Field>

            <section className="space-y-3 rounded-lg border p-3">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <ShieldCheck className="size-4" aria-hidden />
                Quyền riêng tư (phiên bản {POLICY_VERSION})
              </h2>
              <p className="text-xs text-muted-foreground">
                HueTrip không xin vị trí khi bạn đăng ký, không bán dữ liệu. Chỉ xin vị trí khi bạn bấm &ldquo;Vị trí của
                tôi&rdquo;.
              </p>
              <Check {...register("consent_account")} label={CONSENT_ACCOUNT} required error={errors.consent_account?.message} />
              <Check {...register("consent_personalization")} label={CONSENT_PERSONALIZATION} />
            </section>
          </>
        )}

        {serverError && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {serverError}
          </p>
        )}

        <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={isSubmitting}>
          {isSubmitting ? "Đang xử lý…" : mode === "signin" ? "Đăng nhập" : "Tạo tài khoản"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Chưa muốn đăng nhập?{" "}
          <Link href="/map" className="underline">
            Tiếp tục xem bản đồ
          </Link>
        </p>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {error && (
        <span role="alert" className="mt-1 block text-xs font-medium text-destructive">
          {error}
        </span>
      )}
    </label>
  );
}

function Check({
  label,
  required,
  error,
  ...input
}: React.ComponentProps<"input"> & { label: string; required?: boolean; error?: string }) {
  return (
    <div>
      <label className="flex gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" {...input} />
        <span>
          {label}
          {required && <span className="text-destructive"> *</span>}
        </span>
      </label>
      {error && (
        <p role="alert" className="mt-1 pl-6 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">{children}</div>;
}
