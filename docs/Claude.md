# HueTrip – sản phẩm mẫu khóa luận

## Bối cảnh
Web app du lịch Huế, giao diện lấy bản đồ làm trung tâm (Hue Map).
Đặc tả đầy đủ: docs/SRS.md (đọc trước khi làm). Wireframe: docs/wireframes/.
Đang ở GĐ1 – chỉ làm các yêu cầu có ghi "GĐ1" trong SRS.

## Quy ước
- Next.js App Router + TypeScript + Tailwind + shadcn/ui, icon lucide-react.
- Ưu tiên điện thoại (khung 390px), sau đó mới tới máy tính.
- Giao diện 100% tiếng Việt. Tiền VND dạng "150.000đ". Giờ dạng 24h.
- Giai đoạn hiện tại: CHƯA dùng Supabase. Dữ liệu giả để trong lib/mock/.
- Kiểu dữ liệu đặt trong lib/types.ts, bám theo từ điển dữ liệu trong SRS.
- Khi làm một màn hình, ghi mã màn hình (UX-xx) và mã yêu cầu (FR/AC) liên quan trong comment đầu file.
- Không tự ý thêm tính năng ngoài SRS. Chỗ nào SRS chưa rõ thì hỏi lại.