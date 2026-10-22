"use client";

// Đồng bộ chuyến đi khi trạng thái đăng nhập thay đổi (gắn ở layout phía du khách).
// - Vừa đăng nhập: nếu trên máy có lịch chưa lưu → lưu lên tài khoản; ngược lại nạp lịch mới nhất từ server.
// - Đăng xuất: xóa bản nháp trên máy (máy dùng chung không lộ lịch của người trước).

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { clearTripDraft, readTripDraft, replaceTripDraft } from "@/lib/trip-draft";
import { loadLatestTrip, saveDraftToServer } from "@/lib/trip-sync";
import type { Place } from "@/lib/types";

export function TripSync({ places }: { places: Place[] }) {
  const auth = useAuth();
  const prev = useRef(auth.status);
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    const was = prev.current;
    prev.current = auth.status;

    if (auth.status === "signed_out" && was === "signed_in") {
      syncedFor.current = null;
      clearTripDraft();
      return;
    }
    if (auth.status !== "signed_in" || syncedFor.current === auth.user.id) return;
    const userId = auth.user.id;
    syncedFor.current = userId;

    (async () => {
      const local = readTripDraft();
      try {
        if (local?.selected && !local.server) {
          // Lịch tạo trước khi đăng nhập → lưu vào tài khoản (giữ hành động của khách – AC-F8.3-01).
          await saveDraftToServer(local, userId);
          toast.success("Đã lưu lịch trình vào tài khoản của bạn");
          return;
        }
        const remote = await loadLatestTrip(userId, places);
        if (!remote) return;
        const localVersion = local?.server?.user_id === userId ? local.server.version_no : -1;
        if (remote.server!.version_no >= localVersion) replaceTripDraft(remote);
      } catch (e) {
        console.error(e);
        toast.error("Chưa đồng bộ được lịch trình với tài khoản. Thử tải lại trang.");
      }
    })();
  }, [auth, places]);

  return null;
}
