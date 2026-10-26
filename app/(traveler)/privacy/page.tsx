// UC-15 Quản lý quyền riêng tư (GĐ1 cơ bản: quản lý đồng ý). PR-01, BR-PREF-02.
// Xuất / xóa dữ liệu cá nhân (PR-07) làm ở GĐ2.

import type { Metadata } from "next";
import { PrivacyView } from "./_components/privacy-view";

export const metadata: Metadata = { title: "Quyền riêng tư · HueTrip" };

export default function PrivacyPage() {
  return <PrivacyView />;
}
