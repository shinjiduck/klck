// Khung chờ chung khi trang du khách đang tải dữ liệu địa điểm (đóng vai trò Suspense cho mọi trang con).

export default function Loading() {
  return (
    <div className="space-y-3 px-4 pt-5" aria-busy="true" aria-label="Đang tải">
      <div className="h-36 animate-pulse rounded-3xl bg-muted" />
      <div className="h-20 animate-pulse rounded-2xl bg-muted" />
      <div className="h-20 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
