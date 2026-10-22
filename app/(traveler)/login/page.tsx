// UX-08 Đăng nhập / đăng ký, ghi nhận đồng ý (frame "08 DANG NHAP"). AC-F8.3-01, PR-01.

import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./_components/login-form";

export const metadata: Metadata = { title: "Đăng nhập · HueTrip" };

export default function LoginPage() {
  return (
    // LoginForm đọc ?next= và ?error= (useSearchParams) nên cần Suspense.
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
