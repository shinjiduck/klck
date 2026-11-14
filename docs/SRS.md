---
title: "ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS)"
toc-title: "Mục lục"
subtitle: "HueTrip AI – Nền tảng đồng hành du lịch Huế, phân hệ trung tâm Hue Map"
---

# Thông tin tài liệu

| Mục | Nội dung |
|---|---|
| Tên dự án | HueTrip AI + Hue Map |
| Loại tài liệu | Software Requirements Specification (SRS) |
| Phiên bản | 1.1 (bản dùng để xây dựng sản phẩm mẫu GĐ1) |
| Ngày | 21/10/2026 |
| Người soạn | Nam – Business Analyst |
| Tài liệu gốc | BRD HueTrip AI v1.0 |
| Trạng thái | Chờ góp ý và phê duyệt |

**Lịch sử thay đổi**

| Phiên bản | Ngày | Nội dung thay đổi |
|---|---|---|
| 0.2 | 14/10/2026 | Khung BRD/SRS gộp |
| 1.0 | 15/10/2026 | Tách SRS riêng; bổ sung use case, yêu cầu chức năng có mã, tiêu chí chấp nhận cho đối tác, phân loại NFR theo giai đoạn, ma trận truy vết; vẽ lại toàn bộ sơ đồ |
| 1.1 | 21/10/2026 | Thêm chương Phân quyền (vai trò hệ thống + vai trò trong chuyến đi); điều chỉnh theo wireframe Figma (luồng Sở thích → 3 phương án → Hue Map, tên phương án, trường ngày đi/đi cùng ai/điểm bắt buộc, nút Chỉ đường, chọn ngày khi thêm); thêm F2 rút gọn với dữ liệu mưa Open-Meteo và chế độ giả lập; thêm yêu cầu màn hình Admin GĐ1; thêm chương Triển khai sản phẩm mẫu (công cụ tích hợp, cấu trúc dự án, dữ liệu mẫu, thứ tự xây dựng) |

# Giới thiệu

## Mục đích

Tài liệu này đặc tả **hệ thống phải làm gì và phải đạt chất lượng ra sao** để đáp ứng các yêu cầu nghiệp vụ trong BRD. Người đọc chính: người phát triển, người kiểm thử, người thiết kế giao diện và giảng viên hướng dẫn.

## Phạm vi

SRS bao quát toàn bộ chức năng F1–F8 và ba phân hệ hỗ trợ SUP-1 đến SUP-3. Mỗi yêu cầu được gắn **giai đoạn** để biết phần nào làm ngay:

| Giai đoạn | Nội dung |
|---|---|
| **GĐ1 – Demo khóa luận** | F8.1–F8.4, F1 bản cá nhân, F3, Admin quản lý địa điểm (SUP-1 tối thiểu), phân quyền 3 vai trò, ghi nhận đồng ý cơ bản. Tùy chọn nếu kịp: F2 rút gọn (cảnh báo mưa + giả lập) |
| **GĐ2 – Pilot** | F1 đầy đủ, F2, F4, F7, F5/F6 bản mỏng, SUP-1/2/3 |
| **GĐ3 – Mở rộng** | F8.5, F8.6, thanh toán, app mobile, mở rộng địa bàn |

## Quy ước

- **FR-xx-nn**: yêu cầu chức năng. **AC-xx-nn**: tiêu chí chấp nhận, viết dạng *Cho trước / Khi / Thì* (Given / When / Then).
- **NFR-xx**: yêu cầu phi chức năng. **UC-nn**: use case. **BR-xxx**: quy tắc nghiệp vụ trong BRD.
- Mức ưu tiên **P1 / P2 / P3** dùng như trong BRD.
- Các ngưỡng số trong tài liệu là **mục tiêu đề xuất**, trừ khi có ghi nguồn.

# Mô tả tổng quan hệ thống

## Bối cảnh hệ thống

HueTrip là ứng dụng web dạng PWA, ưu tiên điện thoại. Giao diện lấy bản đồ làm trung tâm. Hệ thống tự lưu dữ liệu địa điểm của mình (không dùng API địa điểm bên ngoài làm nguồn chính). Cho phép dùng nguồn bên ngoài (OpenStreetMap, Goong/Mapbox Search) làm **nguồn phụ** để (a) admin nhập hàng loạt thành bản nháp chờ duyệt (FR-ADM-08), (b) gợi ý khi tìm kiếm địa điểm chưa có trong hệ thống (FR-F8-15). Hệ thống gọi dịch vụ bản đồ qua một lớp adapter và gọi Claude API để viết lời giải thích cho gợi ý.

## Tác nhân

| Tác nhân | Mô tả | Giai đoạn |
|---|---|---|
| Khách | Chưa đăng nhập | GĐ1 |
| Du khách | Đã đăng nhập | GĐ1 |
| Trưởng nhóm / Thành viên | Vai trò **trong một chuyến đi**, không phải vai trò tài khoản (xem chương Phân quyền) | GĐ2 |
| Đối tác | Quán ăn, homestay, workshop | GĐ2 |
| Biên tập viên | Đội HueTrip, quản lý nội dung địa điểm | GĐ2 (ở GĐ1 gộp vào Quản trị viên) |
| Quản trị viên | Đội HueTrip, toàn quyền vận hành | GĐ1 |

Quyền chi tiết của từng tác nhân được đặc tả ở chương **Phân quyền**.

## Ràng buộc thiết kế

- Frontend: Next.js + TypeScript, PWA, ưu tiên điện thoại.
- Cơ sở dữ liệu: PostgreSQL + PostGIS (truy vấn theo vùng bản đồ và khoảng cách), triển khai trên Supabase ở GĐ1.
- Backend: một khối mô-đun (modular monolith), chưa tách microservice ở GĐ1, GĐ2. Ở GĐ1 dùng Route Handlers của Next.js làm backend.
- Bản đồ: thư viện hiển thị dùng chung giao diện `react-map-gl`; truy cập nhà cung cấp qua `MapProvider Adapter` (xem chương Kiến trúc và tích hợp).
- Phân quyền: kiểm tra ở **cả hai lớp**: API (backend) và cơ sở dữ liệu (Row Level Security). Không dựa vào việc ẩn nút trên giao diện.
- AI: Claude API chỉ dùng để viết lý do và diễn giải; không quyết định tính khả thi (BR-FEAS-01).
- Múi giờ Asia/Ho_Chi_Minh, tiền tệ VND, mã hóa UTF-8, giao diện tiếng Việt.

## Giả định và phụ thuộc

- Dữ liệu 20–30 điểm (GĐ1) và 30–50 điểm (GĐ2) được nhập và kiểm tra thủ công; đây là các điểm "đã xác minh" dùng để demo lập lịch.
- Ngoài ra, hệ thống nhập hàng loạt địa điểm từ OpenStreetMap (giấy phép ODbL, ghi công "© OpenStreetMap contributors") làm bản nháp; chỉ những điểm admin đã kiểm tra và bổ sung giá, giờ mở cửa mới được xuất bản.
- Nhà cung cấp bản đồ cuối cùng chưa chốt; thiết kế không phụ thuộc vào một nhà cung cấp.
- Dữ liệu thời tiết lấy từ Open-Meteo qua `WeatherProvider Adapter`; khi nguồn lỗi, admin có thể kích hoạt thủ công hoặc dùng chế độ giả lập.
- Tài khoản Quản trị viên đầu tiên được tạo thủ công trong cơ sở dữ liệu; không có chức năng tự đăng ký làm admin.

# Phân quyền

## Nguyên tắc

Hệ thống có **hai tầng quyền** độc lập:

1. **Vai trò hệ thống**: gắn với tài khoản, lưu ở `USER.role`. Gồm: `guest` (không có tài khoản), `traveler`, `partner`, `editor`, `admin`.
2. **Vai trò trong chuyến đi**: gắn với từng chuyến, lưu ở `TRIP_MEMBER.role`. Gồm: `owner`, `member`. Một người có thể là `owner` ở chuyến A và `member` ở chuyến B.

**Quy tắc bảo mật phân quyền** (đề xuất bổ sung vào BRD nhóm BR-ROLE):

| Mã | Quy tắc |
|---|---|
| SEC-ROLE-01 | Mỗi tài khoản chỉ có quyền tối thiểu cần cho công việc. Mặc định tài khoản mới là `traveler`. |
| SEC-ROLE-02 | Mọi thao tác thêm, sửa, xuất bản, ẩn, duyệt, gán vai trò của Biên tập viên và Quản trị viên được ghi vào `AUDIT_LOG` (ai, lúc nào, đối tượng, giá trị trước/sau). |
| SEC-ROLE-03 | Biên tập viên và Quản trị viên **không** xem được chuyến đi, sở thích, album riêng tư của người dùng, trừ khi có yêu cầu hỗ trợ từ chính người dùng đó (GĐ2). |
| SEC-ROLE-04 | Thay đổi do Đối tác gửi chỉ hiển thị công khai sau khi được duyệt. |
| SEC-ROLE-05 | Quyền được kiểm tra ở backend và ở cơ sở dữ liệu (RLS). Giao diện ẩn nút chỉ để tiện dùng, không phải cơ chế bảo mật. |
| SEC-ROLE-06 | Chỉ Quản trị viên được gán hoặc thu hồi vai trò; không ai tự nâng quyền cho chính mình. |

## Ma trận quyền theo vai trò hệ thống

✓ = được phép; "Của mình" = chỉ với dữ liệu của chính mình; – = không được phép.

| Chức năng | Khách | Du khách | Đối tác | Biên tập viên | Quản trị viên | GĐ |
|---|---|---|---|---|---|---|
| Xem Hue Map, thẻ địa điểm đã xuất bản | ✓ | ✓ | ✓ | ✓ | ✓ | 1 |
| Khai sở thích, xem 3 phương án (bản nháp) | ✓ (không lưu) | ✓ | ✓ | ✓ | ✓ | 1 |
| Lưu chuyến đi, thêm/xóa điểm trong lịch | – | Của mình | Của mình | Của mình | Của mình | 1 |
| Xem hoặc sửa chuyến đi của người khác | – | – | – | – | – | – |
| Nhận cảnh báo mưa, áp dụng phương án đổi lịch | – | Của mình | Của mình | Của mình | Của mình | 1 (tùy chọn) |
| Bật chế độ "Giả lập trời mưa" | – | – | – | – | ✓ | 1 (tùy chọn) |
| Xem danh sách địa điểm ở mọi trạng thái (nháp, ẩn) | – | – | – | ✓ | ✓ | 1 |
| Thêm, sửa địa điểm | – | – | – | ✓ | ✓ | 1 |
| Xuất bản, ẩn địa điểm | – | – | – | ✓ | ✓ | 1 |
| Xóa vĩnh viễn địa điểm | – | – | – | – | ✓ | 1 |
| Gửi cập nhật thông tin quán của mình | – | – | Của mình (chờ duyệt) | – | – | 2 |
| Duyệt cập nhật của đối tác | – | – | – | ✓ | ✓ | 2 |
| Quét, đổi voucher | – | – | Tại quán mình | – | ✓ | 2 |
| Tạo Quest, phát voucher, đối soát | – | – | – | – | ✓ | 2 |
| Quản lý tài khoản, gán vai trò | – | – | – | – | ✓ | 1 |
| Xem nhật ký thao tác (AUDIT_LOG) | – | – | – | – | ✓ | 1 |
| Quản lý đồng ý, xuất/xóa dữ liệu cá nhân | – | Của mình | Của mình | Của mình | Của mình | 1 (đồng ý), 2 (xuất/xóa) |

**Ở GĐ1** chỉ triển khai 3 vai trò: **Khách, Du khách, Quản trị viên**. Biên tập viên và Đối tác được đặc tả sẵn để mở rộng ở GĐ2.

## Ma trận quyền trong một chuyến đi (GĐ2)

| Hành động | Chủ chuyến / Trưởng nhóm (`owner`) | Thành viên (`member`) |
|---|---|---|
| Xem lịch, bình luận, đề xuất điểm | ✓ | ✓ |
| Bình chọn | ✓ | ✓ |
| Mời, xóa thành viên | ✓ | – |
| Xác nhận lịch, áp dụng điều chỉnh F2 | ✓ | – |
| Đổi tên, xóa chuyến đi | ✓ | – |
| Rời khỏi chuyến đi | – (phải chuyển quyền chủ trước) | ✓ |

Ở GĐ1, mỗi chuyến đi chỉ có một người là `owner`.

## Cách triển khai phân quyền ở GĐ1

| Lớp | Cách làm |
|---|---|
| Xác thực | Supabase Auth (email + mật khẩu hoặc link đăng nhập qua email; tùy chọn đăng nhập Google) |
| Lưu vai trò | Bảng `profiles` có cột `role`, mặc định `traveler` |
| Cơ sở dữ liệu | Bật Row Level Security cho mọi bảng. Ví dụ: `trips` chỉ cho đọc/ghi khi `owner_id = auth.uid()`; `places` cho mọi người đọc khi `publish_status = 'published'`, chỉ `editor`/`admin` được ghi |
| Backend | Route Handler kiểm tra vai trò trước khi xử lý; trả 401 nếu chưa đăng nhập, 403 nếu không đủ quyền |
| Giao diện | Khu vực `/admin` chỉ hiển thị với `admin`; người khác truy cập bị chuyển hướng |
| Nhật ký | Trigger cơ sở dữ liệu ghi `AUDIT_LOG` khi bảng `places` hoặc `profiles.role` thay đổi |

**Tiêu chí chấp nhận phân quyền**

- **AC-ROLE-01** – *Cho trước* người dùng là `traveler`, *Khi* gọi API sửa địa điểm, *Thì* hệ thống trả 403 và không thay đổi dữ liệu.
- **AC-ROLE-02** – *Cho trước* người dùng A đã đăng nhập, *Khi* truy cập chuyến đi của người dùng B bằng đường dẫn trực tiếp, *Thì* hệ thống trả 404 (không tiết lộ chuyến đi có tồn tại).
- **AC-ROLE-03** – *Cho trước* người dùng chưa đăng nhập, *Khi* truy cập `/admin`, *Thì* bị chuyển đến trang đăng nhập; đăng nhập bằng tài khoản không phải admin thì thấy thông báo "Bạn không có quyền truy cập".
- **AC-ROLE-04** – *Khi* Quản trị viên xuất bản, ẩn hoặc sửa một địa điểm, *Thì* `AUDIT_LOG` có bản ghi tương ứng với giá trị trước và sau.
- **AC-ROLE-05** – *Cho trước* người dùng đổi `role` của chính mình qua API, *Thì* yêu cầu bị từ chối.

# Use case

## Sơ đồ use case tổng thể

![Hình 1. Sơ đồ use case tổng thể](diag/d10_usecase.png){width=4.9in}

## Danh sách use case

| Mã | Use case | Tác nhân | Chức năng | Giai đoạn |
|---|---|---|---|---|
| UC-01 | Xem lịch mẫu | Khách | F1 | GĐ1 |
| UC-02 | Khám phá Hue Map | Khách | F8.1, F8.2 | GĐ1 |
| UC-03 | Xem thẻ địa điểm và lý do "Hợp với bạn" | Khách | F8.2, F8.4 | GĐ1 |
| UC-04 | Tạo chuyến đi, sinh phương án | Du khách | F1 | GĐ1 (cá nhân), GĐ2 (nhóm) |
| UC-05 | Thêm điểm vào lịch | Du khách | F8.3 | GĐ1 |
| UC-06 | Gợi ý ăn, ở theo tuyến | Du khách | F3 | GĐ1 |
| UC-07 | Mời nhóm, bình chọn | Trưởng nhóm, thành viên | F1 | GĐ2 |
| UC-08 | Xác nhận lịch, duyệt điều chỉnh | Trưởng nhóm | F1, F2 | GĐ2 |
| UC-09 | Làm Quest, nhận voucher | Du khách | F4 | GĐ2 |
| UC-10 | Xem sự kiện, "Tối nay làm gì?" | Khách | F7 | GĐ2 |
| UC-11 | Tạo album, chứng nhận hành trình | Du khách | F5 | GĐ2 |
| UC-12 | Đặt trải nghiệm địa phương | Du khách | F6 | GĐ2 |
| UC-13 | Cập nhật thông tin, quét voucher | Đối tác | SUP-1, SUP-2 | GĐ2 |
| UC-14 | Quản lý địa điểm (GĐ1); duyệt nội dung, đối soát voucher (GĐ2) | Quản trị viên, Biên tập viên | SUP-1, SUP-2, SUP-3 | GĐ1 (quản lý địa điểm), GĐ2 |
| UC-15 | Quản lý quyền riêng tư | Du khách | SUP-3 | GĐ1 (cơ bản), GĐ2 |
| UC-16 | Nhận cảnh báo mưa và đổi lịch (rút gọn) | Du khách; Quản trị viên (giả lập) | F2 | GĐ1 (tùy chọn), GĐ2 (đầy đủ) |
| UC-17 | Quản lý tài khoản và vai trò | Quản trị viên | SUP-3 | GĐ1 |

**Luồng tổng thể GĐ1** (khớp wireframe Figma): `01 Sở thích` → `04 Chọn 1 trong 3 phương án` → `02 Hue Map` (xem lịch đã chọn trên bản đồ, khám phá thêm) → `03 Thẻ địa điểm` → Thêm vào lịch → `05 Xung đột` (nếu có) → `06 Lịch ngày` → `07 Gợi ý ăn, ở`. Người dùng cũng có thể mở thẳng Hue Map từ thanh điều hướng mà không cần tạo chuyến trước.

## Đặc tả use case cho GĐ1

### UC-02 Khám phá Hue Map

| Mục | Nội dung |
|---|---|
| Tác nhân | Khách, Du khách |
| Mục tiêu | Tìm địa điểm phù hợp trên bản đồ |
| Tiền điều kiện | Có ít nhất một địa điểm đã xuất bản |
| Hậu điều kiện | Người dùng thấy ghim và danh sách khớp với lớp, bộ lọc, vùng bản đồ |
| Luồng chính | 1. Người dùng mở Hue Map; hệ thống hiển thị bản đồ Huế với các lớp mặc định. 2. Người dùng bật/tắt lớp (Di tích, Điểm du lịch, Ăn uống, Lưu trú). 3. Người dùng chọn bộ lọc (giá, đang mở cửa…). 4. Người dùng kéo/zoom bản đồ. 5. Hệ thống trả về ghim (gộp cụm khi nhiều) và danh sách cùng một tập kết quả. |
| Luồng thay thế | 3a. Người dùng bấm "Xóa bộ lọc": bộ lọc về mặc định, lịch không bị ảnh hưởng. 5a. Không có kết quả: hiển thị thông báo và gợi ý nới bộ lọc. |
| Ngoại lệ | Dịch vụ bản đồ lỗi: vẫn hiển thị danh sách và lịch trình, báo lỗi bản đồ. |
| Quy tắc | BR-MAP-01, BR-MAP-02 |

### UC-03 Xem thẻ địa điểm và lý do "Hợp với bạn"

| Mục | Nội dung |
|---|---|
| Tác nhân | Khách, Du khách |
| Tiền điều kiện | Người dùng đang ở Hue Map |
| Luồng chính | 1. Người dùng bấm vào một ghim hoặc một dòng trong danh sách. 2. Hệ thống mở thẻ: tên, ảnh, danh mục, giờ mở cửa, trạng thái giá, thời gian đi đến, ngày cập nhật, nguồn. 3. Nếu người dùng đã khai sở thích, thẻ hiển thị nhãn "Hợp với bạn" và 1–3 lý do. 4. Thẻ có các nút: Thêm vào lịch, Chỉ đường. |
| Luồng thay thế | 3a. Chưa có sở thích hoặc thiếu dữ liệu: hiển thị "Có thể phù hợp" hoặc không hiển thị nhãn. |
| Quy tắc | BR-MAP-03, BR-MAP-05, BR-SOURCE-01, BR-PRICE-01 |

### UC-04 Tạo chuyến đi, sinh phương án (bản cá nhân)

| Mục | Nội dung |
|---|---|
| Tác nhân | Khách, Du khách |
| Luồng chính | 1. Người dùng khai (màn `01 Sở thích`): sở thích, ngày bắt đầu, số ngày, đi cùng ai, số người, mức ngân sách, nhịp độ, các điểm bắt buộc (không bắt buộc nhập). 2. Hệ thống lọc điểm phù hợp, chấm điểm, xếp lịch. 3. Bộ kiểm tra ràng buộc xác minh giờ mở cửa, thời gian, ràng buộc bắt buộc. 4. Hệ thống hiển thị 3 phương án (màn `04`): **Di sản trọn vẹn / Cân bằng khám phá / Ăn uống & thư giãn**, mỗi phương án có lý do, chi phí ước tính, trạng thái khả thi và tóm tắt số điểm mỗi ngày. 5. Người dùng chọn một phương án; nếu chưa đăng nhập, hệ thống yêu cầu đăng nhập để lưu. 6. Hệ thống mở Hue Map với lịch vừa chọn hiển thị trên bản đồ. |
| Luồng thay thế | 4a. Không tạo được phương án khả thi: hệ thống nêu lý do (ví dụ quá nhiều điểm bắt buộc trong một ngày) và gợi ý nới ràng buộc. |
| Quy tắc | BR-TRIP-01, BR-PREF-01, BR-FEAS-01 |

### UC-05 Thêm điểm vào lịch

| Mục | Nội dung |
|---|---|
| Tác nhân | Du khách |
| Tiền điều kiện | Đang xem thẻ địa điểm |
| Hậu điều kiện | Điểm có trong lịch; tuyến trên bản đồ được cập nhật |
| Luồng chính | 1. Người dùng bấm "Thêm vào lịch", chọn ngày. 2. Hệ thống kiểm tra trùng điểm, giờ mở cửa, chồng giờ, thời gian di chuyển. 3. Hợp lệ: lưu vào lịch, cập nhật tuyến mà không tải lại trang. |
| Luồng thay thế | 1a. Chưa đăng nhập: hệ thống lưu hành động chờ, sau khi đăng nhập quay lại đúng địa điểm và chuyến đi. 2a. Có xung đột: hiển thị xung đột và ít nhất một cách xử lý (đổi giờ, đổi ngày, vẫn thêm). |
| Quy tắc | BR-MAP-04, BR-VERSION-01 |

![Hình 2. Sơ đồ tuần tự UC-05 Thêm điểm vào lịch](diag/d17_seq_add.png){width=6.3in}

### UC-06 Gợi ý ăn, ở theo tuyến

| Mục | Nội dung |
|---|---|
| Tác nhân | Du khách |
| Tiền điều kiện | Chuyến đi có ít nhất một ngày có lịch |
| Luồng chính | 1. Người dùng mở gợi ý ăn uống cho một khung giờ, hoặc gợi ý lưu trú cho cả chuyến. 2. Hệ thống tìm quán gần tuyến trong khung giờ, đang mở, trong ngân sách; với lưu trú, tính tổng thời gian di chuyển tới các điểm trong lịch. 3. Hệ thống hiển thị thẻ có trạng thái giá rõ ràng. |
| Quy tắc | BR-PRICE-01, BR-MAP-05, BR-PREF-02 |

### UC-14 Quản lý địa điểm (GĐ1)

| Mục | Nội dung |
|---|---|
| Tác nhân | Quản trị viên |
| Tiền điều kiện | Đã đăng nhập với vai trò `admin` |
| Hậu điều kiện | Địa điểm được lưu; nếu xuất bản thì xuất hiện trên Hue Map; thao tác được ghi nhật ký |
| Luồng chính | 1. Admin mở `/admin/places`: danh sách địa điểm, lọc theo lớp, trạng thái, "quá hạn cập nhật". 2. Admin bấm "Thêm địa điểm" hoặc chọn một địa điểm để sửa. 3. Admin nhập/sửa các trường (tên, lớp, loại hình, tọa độ bằng cách chấm trên bản đồ nhỏ, giờ mở cửa, giá, trạng thái giá, trong nhà/ngoài trời, thời gian tham quan, ảnh, mô tả, **nguồn và ngày cập nhật**). 4. Hệ thống kiểm tra trường bắt buộc và cảnh báo trùng tên trong bán kính 100 m. 5. Admin lưu ở trạng thái Nháp hoặc bấm Xuất bản. |
| Luồng thay thế | 2a. Admin bấm "Ẩn": địa điểm biến khỏi bản đồ nhưng không mất dữ liệu. 2b. Admin nhập hàng loạt từ file CSV theo mẫu (xem chương Triển khai). |
| Ngoại lệ | 4a. Thiếu nguồn hoặc ngày cập nhật: không cho xuất bản, chỉ cho lưu nháp. |
| Quy tắc | BR-SOURCE-01, BR-MAP-01, SEC-ROLE-02 |

### UC-16 Nhận cảnh báo mưa và đổi lịch (rút gọn, tùy chọn GĐ1)

| Mục | Nội dung |
|---|---|
| Tác nhân | Du khách; Quản trị viên (bật giả lập) |
| Tiền điều kiện | Du khách có chuyến đi đã lưu, ngày đi nằm trong khoảng dự báo (tối đa 7 ngày tới) |
| Luồng chính | 1. Hệ thống lấy dự báo mưa theo giờ cho Huế (khi người dùng mở lịch, và định kỳ). 2. Với mỗi điểm **ngoài trời** trong lịch, nếu khung giờ có xác suất mưa ≥ ngưỡng hoặc lượng mưa ≥ ngưỡng thì đánh dấu "bị ảnh hưởng". 3. Hệ thống hiển thị thanh cảnh báo trên màn Lịch ngày: "Dự báo 70% mưa 14:00–16:00 · Nguồn Open-Meteo · Cập nhật 13:05". 4. Người dùng bấm "Xem phương án": hệ thống đưa 2–3 phương án (đổi sang điểm trong nhà gần đó, hoặc đổi khung giờ). 5. Người dùng chọn "Áp dụng" hoặc "Giữ nguyên". |
| Luồng thay thế | 1a. Quản trị viên bật "Giả lập trời mưa" cho một khung giờ: hệ thống dùng dữ liệu giả lập thay cho dự báo thật và hiển thị nhãn "Chế độ demo". 1b. Nguồn thời tiết lỗi: không hiển thị cảnh báo, lịch giữ nguyên. |
| Quy tắc | BR-F2-01, BR-F2-02, BR-SOURCE-01 |

# Yêu cầu chức năng

## F8 – Hue Map

### Yêu cầu

| Mã | Yêu cầu | Ưu tiên | Giai đoạn |
|---|---|---|---|
| FR-F8-01 | Hệ thống hiển thị bản đồ Huế với chip "Tất cả" và ít nhất 4 lớp: Di tích, Điểm du lịch, Ăn uống, **Lưu trú (khách sạn, homestay)**. GĐ2 bổ sung lớp Quest, Sự kiện, Tiện ích. | P1 | GĐ1 |
| FR-F8-02 | Người dùng bật/tắt nhiều lớp cùng lúc. | P1 | GĐ1 |
| FR-F8-03 | Ghim được gộp thành cụm có số đếm khi vượt ngưỡng; bấm cụm thì zoom vào mà không mất bộ lọc. | P1 | GĐ1 |
| FR-F8-04 | Danh sách bên cạnh (desktop) hoặc ngăn kéo dưới (mobile) luôn khớp với ghim trên bản đồ. | P1 | GĐ1 |
| FR-F8-05 | Mỗi lớp có bộ lọc riêng. GĐ1 tối thiểu: Lưu trú lọc theo **loại hình (khách sạn / homestay)** và mức giá/đêm; Ăn uống lọc theo mức giá và món chay; mọi lớp lọc được "Đang mở cửa". GĐ2 thêm: sức chứa, có bếp, món ăn cụ thể. | P1 | GĐ1 |
| FR-F8-06 | Trạng thái bộ lọc được lưu trên URL để chia sẻ và tải lại được. | P2 | GĐ1 |
| FR-F8-07 | Thẻ địa điểm hiển thị đủ trường tối thiểu (AC-F8.2-03). | P1 | GĐ1 |
| FR-F8-08 | Thêm điểm vào lịch từ thẻ: người dùng **chọn ngày** (và khung giờ gợi ý), hệ thống kiểm tra xung đột. | P1 | GĐ1 |
| FR-F8-09 | Nút "Chỉ đường" trên thẻ. GĐ1: mở Google Maps bằng đường dẫn chỉ đường (không cần API key). GĐ2: vẽ tuyến trong app qua nhà cung cấp bản đồ. | P1 | GĐ1 |
| FR-F8-10 | Tính điểm phù hợp và lý do (reason code) cho từng địa điểm theo sở thích và ngữ cảnh. | P1 | GĐ1 |
| FR-F8-11 | Chế độ theo người đi cùng: gia đình có trẻ nhỏ, người lớn tuổi, nhóm bạn, đi một mình, ăn chay. | P2 | GĐ2 |
| FR-F8-12 | Gợi ý theo ngữ cảnh: trời mưa ưu tiên điểm trong nhà, gần giờ đóng cửa thì cảnh báo, gợi ý điểm ngắm hoàng hôn vào cuối chiều. | P2 | GĐ2 |
| FR-F8-13 | "Bản đồ của tôi": danh sách Muốn đi / Đã đi, tự đặt tên và màu. | P2 | GĐ3 |
| FR-F8-14 | Vùng thuận tiện để chọn nơi ở theo toàn bộ lịch trình; lưu bộ lọc yêu thích. | P2 | GĐ3 |
| FR-F8-15 | Khi tìm kiếm không có kết quả trong hệ thống, hiển thị gợi ý từ nguồn bên ngoài qua `MapProvider.geocode` (Goong/Mapbox Search), ghi rõ nguồn; gợi ý chỉ để xem vị trí và chỉ đường, không thêm vào lịch, không lưu vào cơ sở dữ liệu. | P2 | GĐ2 |

### Tiêu chí chấp nhận

**F8.1 – Lớp bản đồ và vùng nhìn**

- **AC-F8.1-01** – *Cho trước* người dùng mở Hue Map, *Thì* có ít nhất 4 lớp: Di tích, Điểm du lịch, Ăn uống, Lưu trú.
- **AC-F8.1-02** – *Khi* người dùng ngừng kéo/zoom, *Thì* hệ thống chờ 300–500 ms rồi mới gửi yêu cầu theo vùng bản đồ; ghim và danh sách dùng cùng một tập kết quả.
- **AC-F8.1-03** – *Cho trước* số ghim vượt ngưỡng hiển thị, *Thì* ghim được gộp thành cụm; *Khi* bấm cụm, *Thì* bản đồ zoom vào và bộ lọc giữ nguyên.
- **AC-F8.1-04** – Trên điện thoại, danh sách hiển thị dạng ngăn kéo dưới; trên máy tính, dạng cột bên cạnh.
- **AC-F8.1-05** – *Khi* người dùng bật lớp Lưu trú, *Thì* bản đồ hiện ghim khách sạn và homestay với biểu tượng khác nhau, và bộ lọc loại hình xuất hiện.
- **AC-F8.1-06** – Bản đồ có nút phóng to, thu nhỏ và "Vị trí của tôi"; chỉ khi bấm "Vị trí của tôi" mới xin quyền vị trí (PR-02).

**F8.2 – Tìm kiếm, bộ lọc, thẻ địa điểm**

- **AC-F8.2-01** – *Khi* bộ lọc thay đổi, *Thì* trạng thái được phản ánh trên URL hoặc được lưu lại.
- **AC-F8.2-02** – *Khi* bấm "Xóa bộ lọc", *Thì* bản đồ về bộ lọc mặc định và lịch trình không bị xóa.
- **AC-F8.2-03** – Thẻ địa điểm tối thiểu có: tên, danh mục, ảnh, khoảng cách/thời gian đi (nếu có), trạng thái mở cửa, trạng thái giá, nhãn phù hợp, ngày cập nhật.
- **AC-F8.2-04** – *Cho trước* không có kết quả, *Thì* hiển thị gợi ý nới bộ lọc và không hiện ghim nào ngoài kết quả.
- **AC-F8.2-05** – Thẻ hiển thị **giá trị thật kèm nguồn** (ví dụ "Mở cửa 7:00–17:30 · Vé 150.000đ · Nguồn: … · Cập nhật 10/2026"); thiếu dữ liệu thì hiển thị "Không xác định". Không dùng ngôn ngữ nội bộ như "cần xác minh" trên giao diện người dùng.
- **AC-F8.2-06** – Thẻ hiển thị thời gian tham quan gợi ý; nếu người dùng đang có lịch trong ngày, hiển thị thêm thời gian đi từ điểm trước đó.

**F8.3 – Thêm vào lịch và chỉ đường**

- **AC-F8.3-01** – *Cho trước* khách chưa đăng nhập bấm "Thêm vào lịch", *Thì* hệ thống giữ hành động chờ; *Khi* đăng nhập xong, *Thì* quay lại đúng địa điểm và chuyến đi.
- **AC-F8.3-02** – *Cho trước* địa điểm đã có trong cùng ngày, *Thì* hệ thống cảnh báo trước khi thêm trùng.
- **AC-F8.3-03** – *Cho trước* vi phạm giờ mở cửa, chồng giờ hoặc thiếu thời gian di chuyển, *Thì* người dùng thấy xung đột và ít nhất một cách xử lý nếu hệ thống tìm được.
- **AC-F8.3-04** – *Khi* thêm thành công, *Thì* lịch và tuyến trên bản đồ cập nhật mà không tải lại trang.
- **AC-F8.3-05** – *Khi* bấm "Thêm vào lịch", *Thì* hệ thống hỏi thêm vào ngày nào, gợi ý khung giờ trống phù hợp với giờ mở cửa.
- **AC-F8.3-06** – *Khi* bấm "Chỉ đường", *Thì* Google Maps mở ở tab mới (hoặc app Google Maps trên điện thoại) với điểm đến là tọa độ địa điểm.

**F8.4 – "Hợp với bạn"**

- **AC-F8.4-01** – Mỗi gợi ý lưu reason code, ví dụ: `PREFERENCE_MATCH`, `GROUP_FIT`, `ROUTE_FIT`, `BUDGET_FIT`, `WEATHER_FIT`, `OPEN_NOW`.
- **AC-F8.4-02** – Giao diện hiển thị 1–3 lý do dễ hiểu, không hiển thị điểm số thô của mô hình.
- **AC-F8.4-03** – *Cho trước* không đủ dữ liệu, *Thì* không dùng câu khẳng định "Hợp với bạn".
- **AC-F8.4-04** – Địa điểm đang đóng cửa, vượt ngân sách cứng hoặc vi phạm yêu cầu bắt buộc không được xếp hạng cao chỉ vì nội dung tương đồng.
- **AC-F8.4-05** – Lý do phải **nối với lựa chọn của người dùng**. Ví dụ: "Bạn chọn Di tích + Chụp ảnh → lăng có nội thất khảm sành sứ nổi bật". Không dùng câu chung chung như "Gợi ý thêm vào ngày tham quan".
- **AC-F8.4-06** – Trong danh sách ở ngăn kéo dưới, mỗi địa điểm phù hợp hiển thị nhãn ngắn kèm lý do chính (ví dụ "Hợp sở thích · Di tích").

![Hình 3. Sơ đồ tuần tự tải dữ liệu Hue Map theo vùng nhìn](diag/d16_seq_map.png){width=6.3in}

## F1 – Lập tour cá nhân/nhóm

| Mã | Yêu cầu | Ưu tiên | Giai đoạn |
|---|---|---|---|
| FR-F1-01 | Cho xem lịch mẫu và tạo bản nháp không cần tài khoản. | P1 | GĐ1 |
| FR-F1-02 | Màn khai sở thích gồm: sở thích (chọn nhiều), **ngày bắt đầu**, số ngày, **đi cùng ai**, số người, mức ngân sách (Tiết kiệm / Vừa phải / Thoải mái), nhịp độ, **điểm bắt buộc** (tùy chọn). | P1 | GĐ1 |
| FR-F1-03 | Sinh 3 phương án theo chủ đề: **Di sản trọn vẹn**, **Cân bằng khám phá**, **Ăn uống & thư giãn**; mỗi phương án có mô tả, chi phí ước tính/người, trạng thái khả thi và số điểm mỗi ngày. | P1 | GĐ1 |
| FR-F1-04 | Kiểm tra ràng buộc trước khi gắn trạng thái "Khả thi". | P1 | GĐ1 |
| FR-F1-05 | Lưu phiên bản lịch, xem lại phiên bản trước. | P1 | GĐ2 |
| FR-F1-06 | Mời thành viên, đề xuất, bình chọn, bình luận; trưởng nhóm xác nhận. | P1 | GĐ2 |

- **AC-F1-01** – *Cho trước* khách nhập ngày, số người, ngân sách và ít nhất 1 sở thích, *Khi* yêu cầu tạo lịch, *Thì* hệ thống cho xem bản nháp trước khi bắt buộc tạo tài khoản.
- **AC-F1-02** – *Cho trước* đủ dữ liệu, *Khi* tạo lịch, *Thì* hệ thống trả tối đa 3 phương án phân biệt rõ (Di sản trọn vẹn / Cân bằng khám phá / Ăn uống & thư giãn), mỗi phương án có lý do và chi phí ước tính kèm ghi chú "chi phí ước tính, chưa được nhà cung cấp xác nhận".
- **AC-F1-03** – Mỗi mục trong lịch có: địa điểm/hoạt động, giờ bắt đầu–kết thúc hoặc thời lượng, thời gian di chuyển, chi phí ước tính, nguồn và ngày cập nhật khi áp dụng.
- **AC-F1-04** – *Cho trước* một mục vi phạm yêu cầu bắt buộc, giờ mở cửa hoặc chồng giờ, *Thì* phương án không được gắn "Khả thi" cho đến khi được xử lý hoặc người dùng chấp nhận ngoại lệ.
- **AC-F1-05** – *Cho trước* lịch đã xác nhận, *Khi* cấu trúc lịch thay đổi, *Thì* tạo phiên bản mới và vẫn truy xuất được phiên bản trước.
- **AC-F1-06** – Mỗi thẻ phương án hiển thị trạng thái khả thi: "✓ Đã kiểm tra giờ mở cửa" hoặc "⚠ N điểm cần đổi giờ", và tóm tắt "Ngày 1: 4 điểm · Ngày 2: 3 điểm".
- **AC-F1-07** – Thanh tiến trình các bước (Bước 01/03, 02/03, 03/03) khớp đúng thứ tự màn hình: Sở thích → Chọn phương án → Xem trên bản đồ.

## F2 – Điều chỉnh khi mưa/sự cố

| Mã | Yêu cầu | Ưu tiên | Giai đoạn |
|---|---|---|---|
| FR-F2-01 | Kích hoạt điều chỉnh thủ công (người dùng) hoặc qua cờ thời tiết/sự kiện (admin). | P1 | GĐ2 |
| FR-F2-02 | Sinh 2–3 phương án thay thế, hiển thị chênh lệch. | P1 | GĐ2 |
| FR-F2-03 | Trưởng nhóm duyệt; áp dụng tạo phiên bản mới. | P1 | GĐ2 |

- **AC-F2-01** – Hỗ trợ tối thiểu hai nguồn kích hoạt: người dùng tự báo và cờ thời tiết/sự kiện do admin bật.
- **AC-F2-02** – Mỗi lần điều chỉnh trả 2–3 phương án nếu có thể; nếu không, giải thích rõ lý do.
- **AC-F2-03** – Mỗi phương án hiển thị chênh lệch: thời gian, chi phí, điểm bị bỏ/thêm, dịch vụ đã đặt và Quest bị ảnh hưởng.
- **AC-F2-04** – Với chuyến đi nhóm, chỉ chủ chuyến/trưởng nhóm được bấm "Áp dụng".
- **AC-F2-05** – Áp dụng tạo phiên bản mới; không tự hủy hoặc đổi dịch vụ đã trả phí.

**F2 rút gọn dùng dữ liệu mưa (tùy chọn GĐ1)**

| Mã | Yêu cầu | Ưu tiên | Giai đoạn |
|---|---|---|---|
| FR-F2-04 | Lấy dự báo theo giờ (xác suất mưa, lượng mưa) cho Huế từ Open-Meteo qua `WeatherProvider Adapter`; lưu bản chụp dự báo kèm thời điểm lấy. | P2 | GĐ1 (tùy chọn) |
| FR-F2-05 | Đánh dấu điểm **ngoài trời** bị ảnh hưởng khi khung giờ có xác suất mưa ≥ 60% **hoặc** lượng mưa ≥ 2 mm/giờ (ngưỡng cấu hình được). | P2 | GĐ1 (tùy chọn) |
| FR-F2-06 | Hiển thị cảnh báo trên Lịch ngày và đề xuất 2–3 phương án (điểm trong nhà gần đó, hoặc đổi khung giờ). | P2 | GĐ1 (tùy chọn) |
| FR-F2-07 | Chế độ "Giả lập trời mưa" chỉ dành cho Quản trị viên, dùng khi trình diễn. | P2 | GĐ1 (tùy chọn) |

- **AC-F2-06** – Cảnh báo luôn ghi nguồn và thời điểm cập nhật dự báo (BR-SOURCE-01).
- **AC-F2-07** – Mỗi khung giờ chỉ đề xuất một lần; chỉ đề xuất lại khi xác suất mưa thay đổi từ 20 điểm phần trăm trở lên.
- **AC-F2-08** – Hệ thống không tự đổi lịch; chỉ đổi khi người dùng bấm "Áp dụng".
- **AC-F2-09** – *Cho trước* nguồn thời tiết lỗi hoặc quá 5 giây không phản hồi, *Thì* không hiển thị cảnh báo và lịch giữ nguyên.
- **AC-F2-10** – Khi chế độ giả lập đang bật, giao diện hiển thị nhãn "Chế độ demo" để không nhầm với dự báo thật.

## F3 – Ăn uống và lưu trú theo tuyến

| Mã | Yêu cầu | Ưu tiên | Giai đoạn |
|---|---|---|---|
| FR-F3-01 | Gợi ý ăn uống theo khung giờ, độ lệch tuyến, giờ mở cửa, ngân sách. | P1 | GĐ1 |
| FR-F3-02 | Gợi ý lưu trú theo toàn bộ lịch trình, hiển thị tổng thời gian di chuyển/ngày. | P1 | GĐ1 |
| FR-F3-03 | Phân biệt "Giá tham khảo" / "Đối tác xác nhận" / "Không xác định". | P1 | GĐ1 |

- **AC-F3-01** – Gợi ý ăn uống xét khung giờ, độ lệch khỏi tuyến và giờ mở cửa; nếu người dùng đã khai chế độ ăn, phải áp dụng.
- **AC-F3-02** – Gợi ý lưu trú xét toàn bộ lịch trình, không chỉ khoảng cách từ vị trí hiện tại.
- **AC-F3-03** – Thẻ luôn ghi rõ một trong ba trạng thái giá: "Giá tham khảo", "Đối tác xác nhận", "Không xác định".
- **AC-F3-04** – Kết quả tài trợ có nhãn "Tài trợ / Đối tác", không trình bày như kết quả tự nhiên.

## F4 – Hue Quest và voucher

| Mã | Yêu cầu | Ưu tiên | Giai đoạn |
|---|---|---|---|
| FR-F4-01 | Quest có thời gian bắt đầu/kết thúc, điều kiện tham gia, cách xác minh, phần thưởng. | P1 | GĐ2 |
| FR-F4-02 | Xác minh check-in bằng vị trí cộng QR hoặc mã nhân viên. | P1 | GĐ2 |
| FR-F4-03 | Phát voucher, quản lý vòng đời, đổi voucher đúng một lần. | P1 | GĐ2 |

- **AC-F4-01** – Quest có thời gian bắt đầu/kết thúc, điều kiện tham gia, cách xác minh và phần thưởng.
- **AC-F4-02** – Phần thưởng giá trị cao cần QR, mã nhân viên hoặc cơ chế thứ hai ngoài GPS.
- **AC-F4-03** – Cùng một mã voucher không đổi thành công lần thứ hai.
- **AC-F4-04** – Mỗi lần đổi ghi thời điểm, người dùng, voucher, đối tác, chuyển trạng thái và sự kiện nhật ký.
- **AC-F4-05** – *Cho trước* yêu cầu bị quá thời gian chờ sau khi đối tác đã quét, *Khi* gửi lại, *Thì* không phát sinh lần đổi thứ hai.

![Hình 4. Sơ đồ tuần tự đổi voucher an toàn khi gửi lặp](diag/d18_seq_redeem.png){width=6.3in}

## F5 – Hue Memory

| Mã | Yêu cầu | Ưu tiên | Giai đoạn |
|---|---|---|---|
| FR-F5-01 | Album tự sắp theo ngày và địa điểm, mặc định riêng tư. | P2 | GĐ2 |
| FR-F5-02 | Chọn ảnh, tạo chứng nhận hành trình có mã QR. | P2 | GĐ2 |
| FR-F5-03 | Chia sẻ link có kiểm soát quyền; tự xóa dữ liệu GPS trong ảnh khi chia sẻ. | P2 | GĐ2 |

**Tiêu chí đạt:** album mặc định riêng tư; người dùng chọn được ảnh, tạo chứng nhận có QR và chia sẻ link có quyền truy cập. Tạo video tự động nâng cao để sau.

## F6 – Kết nối địa phương

| Mã | Yêu cầu | Ưu tiên | Giai đoạn |
|---|---|---|---|
| FR-F6-01 | Danh mục workshop, làng nghề, trao đổi ngoại ngữ, có sức chứa, thời gian, ngôn ngữ. | P2 | GĐ2 |
| FR-F6-02 | Gửi yêu cầu tham gia; đối tác hoặc admin xác nhận thủ công. | P2 | GĐ2 |

**Tiêu chí đạt:** người dùng xem danh mục, gửi yêu cầu; đối tác hoặc admin xác nhận thủ công được.

## F7 – Sự kiện và "Tối nay làm gì?"

| Mã | Yêu cầu | Ưu tiên | Giai đoạn |
|---|---|---|---|
| FR-F7-01 | Lọc sự kiện theo ngày, khoảng cách, ngân sách. | P1 | GĐ2 |
| FR-F7-02 | Thêm sự kiện vào lịch, dùng chung bộ kiểm tra xung đột với địa điểm. | P1 | GĐ2 |

- **AC-F7-01** – Sự kiện chỉ được gợi ý khi thời gian diễn ra khớp với truy vấn hoặc ngày của chuyến đi.
- **AC-F7-02** – Thêm sự kiện vào lịch chạy cùng bộ kiểm tra xung đột như địa điểm.
- **AC-F7-03** – Sự kiện đã kết thúc vẫn xem được trang lưu trữ nhưng không xuất hiện dưới nhãn "Tối nay".

## SUP – Phân hệ hỗ trợ và cổng đối tác

| Mã | Yêu cầu | Ưu tiên | Giai đoạn |
|---|---|---|---|
| FR-SUP-01 | Thêm/sửa/duyệt/ẩn địa điểm; mỗi trường động có nguồn và ngày cập nhật. | P1 | GĐ1 (nhập qua file seed), GĐ2 (giao diện admin) |
| FR-SUP-02 | Cảnh báo trùng địa điểm theo tên + khoảng cách. | P1 | GĐ2 |
| FR-SUP-03 | Ảnh tải lên có chủ sở hữu, nguồn, giấy phép. | P1 | GĐ2 |
| FR-SUP-04 | Đối tác cập nhật thông tin qua form ngắn, gửi admin duyệt. | P1 | GĐ2 |
| FR-SUP-05 | Đối tác nhận và xác nhận yêu cầu trải nghiệm (F6). | P2 | GĐ2 |
| FR-SUP-06 | Đối tác quét voucher trên điện thoại. | P1 | GĐ2 |
| FR-SUP-07 | Báo cáo đối soát voucher hằng ngày. | P1 | GĐ2 |
| FR-SUP-08 | Nhật ký lỗi, mã yêu cầu xuyên suốt, sự kiện phân tích, nhật ký đồng ý. | P1 | GĐ1 (cơ bản), GĐ2 |

**Khu vực Admin ở GĐ1**

| Mã | Yêu cầu | Ưu tiên | Giai đoạn |
|---|---|---|---|
| FR-ADM-01 | Trang danh sách địa điểm: tìm theo tên, lọc theo lớp, trạng thái xuất bản, "quá hạn cập nhật"; hiển thị ngày cập nhật và nguồn. | P1 | GĐ1 |
| FR-ADM-02 | Form thêm/sửa địa điểm, chọn tọa độ bằng cách chấm trên bản đồ nhỏ; trường nguồn và ngày cập nhật bắt buộc khi xuất bản. | P1 | GĐ1 |
| FR-ADM-03 | Nút Xuất bản / Ẩn / Lưu nháp; xóa vĩnh viễn cần xác nhận lần hai. | P1 | GĐ1 |
| FR-ADM-04 | Nhập hàng loạt từ file CSV theo mẫu; báo các dòng lỗi trước khi lưu. | P2 | GĐ1 |
| FR-ADM-05 | Trang người dùng: xem danh sách tài khoản, đổi vai trò (chỉ admin). | P2 | GĐ1 |
| FR-ADM-06 | Trang nhật ký thao tác (AUDIT_LOG), lọc theo người thực hiện và ngày. | P2 | GĐ1 |
| FR-ADM-07 | Công tắc "Giả lập trời mưa" (gắn với FR-F2-07). | P2 | GĐ1 (tùy chọn) |
| FR-ADM-08 | Nhập hàng loạt từ nguồn bên ngoài (OpenStreetMap qua Overpass API; GĐ2 thêm Goong/Mapbox Search): công cụ sinh file CSV theo mẫu FR-ADM-04, mọi dòng ở trạng thái **Nháp**, giá `unknown`, nguồn ghi tên nguồn + giấy phép + link đối tượng gốc. Điểm trùng tên hoặc trùng tên trong bán kính 100 m với điểm đã có bị bỏ, không ghi đè. | P2 | GĐ1 |

- **AC-ADM-01** – *Cho trước* thiếu nguồn hoặc ngày cập nhật, *Khi* bấm Xuất bản, *Thì* hệ thống báo lỗi ngay tại trường thiếu và chỉ cho lưu nháp.
- **AC-ADM-02** – *Khi* nhập file CSV có dòng sai định dạng tọa độ, *Thì* hệ thống liệt kê số dòng lỗi và không lưu dòng đó.
- **AC-ADM-03** – Địa điểm ở trạng thái Nháp hoặc Ẩn không xuất hiện trên Hue Map và không trả về qua API công khai.
- **AC-ADM-04** – *Khi* nhập dữ liệu từ nguồn bên ngoài (FR-ADM-08), *Thì* không điểm nào được xuất bản tự động, và không điểm đã có nào bị ghi đè; điểm bị bỏ vì trùng được liệt kê trong báo cáo nhập.

**Tiêu chí chấp nhận cho admin**

- **AC-SUP-01** – Mọi thao tác xuất bản/ẩn ghi người thực hiện và thời điểm.
- **AC-SUP-02** – Trường động của địa điểm và sự kiện (giá, giờ mở cửa) có nguồn và ngày cập nhật.
- **AC-SUP-03** – Khi tạo địa điểm trùng tên trong bán kính 100 m, hệ thống cảnh báo.
- **AC-SUP-04** – Địa điểm quá hạn cập nhật (mặc định 90 ngày) được gắn cờ "Cần kiểm tra".

**Tiêu chí chấp nhận cho đối tác** (persona Lan – chủ quán)

- **AC-PTN-01** – Đối tác cập nhật giờ mở cửa và giá trong không quá 3 bước, không cần đào tạo.
- **AC-PTN-02** – *Khi* đối tác gửi cập nhật, *Thì* thông tin cũ vẫn hiển thị cho đến khi admin duyệt; đối tác thấy trạng thái "Đang chờ duyệt".
- **AC-PTN-03** – *Khi* có yêu cầu trải nghiệm mới, *Thì* đối tác nhận thông báo và có thể xác nhận hoặc từ chối kèm lý do.
- **AC-PTN-04** – *Khi* quét voucher, *Thì* đối tác thấy kết quả rõ ràng (Hợp lệ / Đã dùng / Hết hạn / Không thuộc quán) trong vòng 3 giây.
- **AC-PTN-05** – Đối tác xem được danh sách voucher đã đổi tại quán theo ngày.

**Tiêu chí chấp nhận cho voucher và vận hành**

- **AC-SUP-05** – Chuyển trạng thái voucher là thao tác nguyên tử; API đổi voucher chống gửi lặp (idempotent).
- **AC-SUP-06** – Mã yêu cầu được ghi xuyên suốt Frontend → Backend → AI / Map Adapter.
- **AC-SUP-07** – Sự kiện đồng ý có thể truy vết; mức dùng và chi phí API bản đồ có cảnh báo khi vượt ngưỡng.

# Yêu cầu dữ liệu

## Mô hình dữ liệu logic

![Hình 5. ERD phần lõi: người dùng, chuyến đi, địa điểm](diag/d12_erd_a.png){width=6.5in}

![Hình 6. ERD phần mở rộng: đối tác, Quest, voucher, Memory, đồng ý](diag/d13_erd_b.png){width=6.0in}

Có thể tái sử dụng các bảng `places`, `categories`, `tags`, `events`, `place_images` từ thiết kế Digital Local Guide [TL2]. Tuy nhiên, bảng lịch trình đơn giản được thay bằng cặp `TRIP` + `TRIP_VERSION` để hỗ trợ quản lý phiên bản.

## Từ điển dữ liệu chính

**PLACE – Địa điểm**

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| id | uuid | Có | Khóa chính |
| name | text | Có | Tên địa điểm |
| location | geography(Point, 4326) | Có | Tọa độ, dùng cho truy vấn vùng bản đồ |
| primary_category_id | uuid | Có | Danh mục chính (BR-MAP-01) |
| opening_hours | json | Không | Giờ mở cửa theo thứ; thiếu thì hiển thị "Không xác định" |
| visit_duration_min | int | Không | Thời gian tham quan gợi ý |
| price_min_vnd, price_max_vnd | int | Không | Khoảng giá |
| price_status | enum | Có | `estimated` / `confirmed` / `unknown` (BR-PRICE-01) |
| indoor | bool | Không | Dùng cho gợi ý khi trời mưa |
| source | text | Có | Nguồn dữ liệu (BR-SOURCE-01) |
| updated_at | timestamptz | Có | Ngày cập nhật |
| confidence | enum | Không | `high` / `medium` / `low` |
| is_sponsored | bool | Có | Nội dung tài trợ (BR-MAP-05) |
| publish_status | enum | Có | `draft` / `pending` / `published` / `hidden` |
| layer | enum | Có | `heritage` / `attraction` / `food` / `stay` (lớp hiển thị trên Hue Map) |
| lodging_type | enum | Khi `layer = stay` | `hotel` / `homestay` |
| vegetarian_friendly | bool | Không | Bộ lọc món chay của lớp Ăn uống |
| address, ward | text | Không | Địa chỉ hiển thị trên thẻ |
| description | text | Không | Mô tả ngắn, dùng làm nguyên liệu cho lý do "Hợp với bạn" |
| highlight_tags | text[] | Không | Điểm nổi bật để nối với sở thích, ví dụ `photo_spot`, `architecture`, `sunset` |

**PROFILES – Hồ sơ và vai trò**

| Trường | Kiểu | Mô tả |
|---|---|---|
| id | uuid | Trùng với id tài khoản trong Supabase Auth |
| display_name | text | Tên hiển thị |
| role | enum | `traveler` (mặc định) / `partner` / `editor` / `admin` |
| created_at | timestamptz | Ngày tạo |

**TRIP_MEMBER – Thành viên chuyến đi**

| Trường | Kiểu | Mô tả |
|---|---|---|
| trip_id, user_id | uuid | Khóa chính ghép |
| role | enum | `owner` / `member` (GĐ1 chỉ có `owner`) |

**WEATHER_SNAPSHOT – Bản chụp dự báo (tùy chọn GĐ1)**

| Trường | Kiểu | Mô tả |
|---|---|---|
| id | uuid | Khóa chính |
| forecast_for | timestamptz | Khung giờ được dự báo |
| precip_probability | int | Xác suất mưa (%) |
| precipitation_mm | numeric | Lượng mưa (mm/giờ) |
| source | text | `open-meteo` hoặc `simulated` |
| fetched_at | timestamptz | Thời điểm lấy dữ liệu |

**AUDIT_LOG – Nhật ký thao tác**

| Trường | Kiểu | Mô tả |
|---|---|---|
| id | bigint | Khóa chính |
| actor_id | uuid | Người thực hiện |
| action | text | `create` / `update` / `publish` / `hide` / `delete` / `role_change` |
| entity, entity_id | text, uuid | Đối tượng bị tác động |
| before, after | jsonb | Giá trị trước và sau |
| at | timestamptz | Thời điểm |

**TRIP / TRIP_VERSION / ITINERARY_ITEM**

| Trường | Kiểu | Mô tả |
|---|---|---|
| TRIP.status | enum | `draft`, `proposed`, `confirmed`, `adjusting`, `in_progress`, `completed`, `cancelled` |
| TRIP.budget_vnd | int | Ngân sách cả chuyến |
| TRIP.pace | enum | `relaxed` / `normal` / `packed` |
| TRIP_VERSION.version_no | int | Tăng dần, dùng cho khóa lạc quan |
| TRIP.start_date, day_count | date, int | Ngày bắt đầu và số ngày |
| TRIP.travel_with, party_size | enum, int | Đi cùng ai, số người |
| TRIP.budget_level | enum | `saving` / `moderate` / `comfortable` (Tiết kiệm / Vừa phải / Thoải mái) |
| TRIP_VERSION.plan_type | enum | `heritage` / `balanced` / `food_relax` (Di sản trọn vẹn / Cân bằng khám phá / Ăn uống & thư giãn) |
| TRIP_VERSION.is_current | bool | Chỉ một phiên bản hiện hành mỗi chuyến |
| ITINERARY_ITEM.day_no | int | Ngày thứ mấy của chuyến |
| ITINERARY_ITEM.start_time, duration_min | time, int | Khung giờ |
| ITINERARY_ITEM.travel_min | int | Thời gian di chuyển từ mục trước |
| ITINERARY_ITEM.is_out_of_range | bool | Đánh dấu "ngoài lịch" (BR-TRIP-01) |

**USER_PREFERENCE – Sở thích**

| Trường | Kiểu | Mô tả |
|---|---|---|
| interests | text[] | Ví dụ: `heritage`, `food`, `photo`, `nature`, `nightlife` |
| must_haves | json | Yêu cầu bắt buộc, tách khỏi sở thích (BR-PREF-01) |
| dietary | text[] | Chỉ lưu khi người dùng tự khai (BR-PREF-02) |
| travel_with | enum | `solo`, `couple`, `friends`, `family_kids`, `seniors` |

**RECOMMENDATION_LOG – Nhật ký gợi ý**

| Trường | Kiểu | Mô tả |
|---|---|---|
| place_id, user_id, trip_id | uuid | Đối tượng được gợi ý |
| match_score | numeric | Điểm nội bộ, không hiển thị thô |
| reason_codes | text[] | `PREFERENCE_MATCH`, `ROUTE_FIT`… (AC-F8.4-01) |
| rule_version, model_version | text | Để truy vết khi kết quả sai |

## Vòng đời trạng thái

![Hình 7. Vòng đời trạng thái của chuyến đi](diag/d14_trip_state.png){width=4.6in}

![Hình 8. Vòng đời trạng thái của voucher](diag/d15_voucher_state.png){width=4.4in}

Các trạng thái khác cần đặc tả ở GĐ2: phiên bản/đề xuất trong nhóm, trạng thái xuất bản địa điểm, trạng thái "Muốn đi / Đã đi" của người dùng.

## Đầu vào – xử lý – đầu ra theo chức năng

| Chức năng | Đầu vào | Xử lý | Đầu ra | Dữ liệu lưu chính |
|---|---|---|---|---|
| F1 | Ngày, ngân sách, nhóm, sở thích | Lọc + xếp hạng + kiểm tra ràng buộc | 1–3 phương án | Trip, Preference, Version, Item |
| F2 | Nguồn kích hoạt, phiên bản hiện tại | Đánh giá ảnh hưởng + phương án + kiểm tra | Đề xuất điều chỉnh | Adjustment, Version |
| F3 | Lịch, khung giờ ăn, ngân sách | Xếp hạng theo độ khớp tuyến | Thẻ quán ăn / lưu trú | Nhật ký gợi ý |
| F4 | Quest, QR / vị trí / mã | Xác minh + ghi sổ nguyên tử | Điểm, voucher | Completion, Ledger, Voucher |
| F5 | Chuyến đi + ảnh đã chọn | Sắp xếp, tạo chứng nhận | Album, chứng nhận | Album, Media |
| F6 | Ngày, nhóm, ngôn ngữ | Đối chiếu sức chứa, điều kiện | Yêu cầu trải nghiệm | ExperienceRequest |
| F7 | Thời gian, vị trí, ngân sách | Lọc sự kiện đang diễn ra | Gợi ý sự kiện | Event, Item |
| F8 | Vùng bản đồ, lớp, bộ lọc, ngữ cảnh chuyến | Truy vấn PostGIS + chấm điểm | GeoJSON, thẻ, nhãn phù hợp | Nhật ký phân tích |

# Yêu cầu giao diện

## Danh sách màn hình

Mã màn hình khớp với tên frame trong file Figma `HueTrip – Wireframe`.

**Màn hình người dùng GĐ1**

| Mã | Frame Figma | Màn hình | Yêu cầu chính | Trạng thái wireframe |
|---|---|---|---|---|
| UX-01 | `01 SOTHICH` | Khai sở thích, thiết lập chuyến đi | FR-F1-02 | Đã vẽ; cần thêm ngày bắt đầu, đi cùng ai, điểm bắt buộc |
| UX-02 | `02 HUEMAP` | Hue Map + ngăn kéo danh sách | FR-F8-01 → 06 | Đã vẽ; cần thêm lớp Lưu trú, Điểm du lịch, ghim cụm, nút "−" và "Vị trí của tôi" |
| UX-03 | `03 DIA DIEM` | Thẻ địa điểm | FR-F8-07 → 10 | Đã vẽ; cần thêm nút Chỉ đường, giá trị thật kèm nguồn, lý do nối với sở thích |
| UX-04 | `04 3 PHUONG AN` | Chọn 1 trong 3 phương án | FR-F1-03, 04 | Đã vẽ; cần thêm trạng thái khả thi và tóm tắt số điểm mỗi ngày |
| UX-05 | `05 XUNG DOT` | Cảnh báo xung đột khi thêm vào lịch | AC-F8.3-02, 03 | Đang vẽ |
| UX-06 | `06 LICH NGAY` | Lịch theo ngày + tuyến trên bản đồ (+ thanh cảnh báo mưa nếu làm F2 rút gọn) | FR-F8-08, FR-F2-06 | Đang vẽ |
| UX-07 | `07 AN O` | Gợi ý ăn uống, lưu trú theo tuyến | FR-F3-01 → 03 | Đang vẽ |
| UX-08 | `08 DANG NHAP` | Đăng nhập / đăng ký, ghi nhận đồng ý | AC-F8.3-01, PR-01 | Chưa vẽ |

**Màn hình Admin GĐ1** (chỉ cho máy tính)

| Mã | Màn hình | Yêu cầu chính |
|---|---|---|
| UX-A1 | Danh sách địa điểm | FR-ADM-01 |
| UX-A2 | Form thêm/sửa địa điểm (có bản đồ nhỏ để chấm tọa độ) | FR-ADM-02, 03 |
| UX-A3 | Nhập CSV | FR-ADM-04 |
| UX-A4 | Người dùng và vai trò | FR-ADM-05 |
| UX-A5 | Nhật ký thao tác | FR-ADM-06 |

**Màn hình GĐ2**: bình chọn nhóm, so sánh phương án điều chỉnh đầy đủ, quét Quest và voucher, sự kiện "Tối nay", album và chứng nhận, cổng đối tác, admin voucher và đối soát.

## Bố cục Hue Map (UX-01)

Ba nguyên tắc: **bản đồ là khung chính**; lớp và bộ lọc luôn nhìn thấy nhưng không che bản đồ; thẻ địa điểm giải thích "Hợp với bạn" và cho thêm thẳng vào lịch.

| Vùng | Máy tính | Điện thoại |
|---|---|---|
| Thanh trên | Ô tìm kiếm + các chip lớp bật/tắt | Ô tìm kiếm + chip lớp cuộn ngang |
| Bộ lọc | Thanh bộ lọc dưới chip, đổi theo lớp đang bật | Nút "Bộ lọc" mở bảng từ dưới lên |
| Danh sách | Cột trái, rê chuột vào dòng thì ghim tương ứng nổi lên | Ngăn kéo dưới, kéo lên để xem thêm |
| Bản đồ | Phần còn lại của màn hình | Toàn màn hình phía sau ngăn kéo |
| Thẻ địa điểm | Bảng nổi cạnh ghim được chọn | Ngăn kéo mở nửa màn hình |
| Lịch trình | Nút mở bảng lịch bên phải, tuyến vẽ trên bản đồ | Tab "Lịch" ở thanh điều hướng dưới |

Mọi màn hình cần đủ các trạng thái: rỗng, đang tải, lỗi, mất mạng.

# Kiến trúc và tích hợp

## Kiến trúc tổng thể

![Hình 9. Kiến trúc hệ thống đề xuất](diag/d11_arch.png){width=6.3in}

- **Frontend:** Next.js + TypeScript, PWA; TanStack Query cho dữ liệu bản đồ; React Hook Form + Zod cho form [TL2].
- **Backend:** khối mô-đun gồm Auth/User, Place/Map, Trip, Recommendation, Event/Experience, Quest/Voucher, Media, Partner/Admin, Privacy/Audit.
- **Recommendation/AI:** lấy dữ liệu đã duyệt → lọc cứng → chấm điểm và xếp hạng → AI viết lời giải thích. AI không tự quyết tính khả thi.
- **Constraint Engine:** kiểm tra giờ mở cửa, thời lượng, thời gian di chuyển, chồng giờ, yêu cầu bắt buộc, ngân sách cứng.

## Lớp Map Provider Adapter

Mọi lời gọi tới nhà cung cấp bản đồ đi qua một giao diện chung, để đổi nhà cung cấp mà không sửa nghiệp vụ:

```
MapProvider
  geocode(query, region)
  reverseGeocode(lat, lng)
  route(points, mode)
  matrix(points, mode)
  getMapConfig()
  normalizePlace(raw)
```

## So sánh nhà cung cấp bản đồ

Thông tin giá công khai tra cứu ngày 14/10/2026, có thể thay đổi; **phải kiểm tra lại trước khi chọn**.

| Nhà cung cấp | Hạn mức miễn phí đáng chú ý | Giá tham khảo | Hiển thị chủ quyền | Đánh giá |
|---|---|---|---|---|
| Google Maps Platform [R4] | 10.000 lượt tải bản đồ động/tháng | 7 USD / 1.000 lượt ở bậc đầu | Hỗ trợ `language=vi`, `region=VN`; chưa tìm thấy cam kết công khai về Hoàng Sa, Trường Sa ở mọi mức zoom | Hệ sinh thái mạnh; chi phí Places tính riêng; bắt buộc kiểm tra hình ảnh |
| Mapbox [R1] | 50.000 lượt tải web/tháng; 100.000 lượt Directions/tháng | 5 USD / 1.000 lượt tải tiếp theo; Directions 2 USD / 1.000 | Có tham số `worldview=VN` chính thức | **Ứng viên mạnh** nếu cần tùy biến giao diện |
| OSM + MapLibre [R5] | Dữ liệu mở; tile công cộng **không phải** dịch vụ miễn phí cho môi trường sản phẩm | Tùy nhà cung cấp tile hoặc tự host | Phụ thuộc style và dữ liệu; phải tự kiểm tra | Trung lập nhất; không dùng `tile.openstreetmap.org` làm hạ tầng chính |
| Goong [R2] | 30.000 request/tháng, 1.000 lượt tải bản đồ | 3 USD / 1.000 lượt tải; Directions 2,5 USD / 1.000 | Nhà cung cấp tự công bố phản ánh Hoàng Sa, Trường Sa (chưa phải chứng nhận độc lập) | Đáng thử cho Việt Nam; cần cam kết bằng văn bản |
| VIETMAP [R3] | 60.000 giao dịch miễn phí cho tài khoản mới | Tùy loại API; 25 tile nền = 1 giao dịch | Tài liệu công khai chưa có cam kết cụ thể | Đáng thử nhờ dữ liệu và tuyến đường Việt Nam |

**Khuyến nghị cho GĐ1:**

- Hiển thị bản đồ bằng `react-map-gl`, thư viện hỗ trợ cả Mapbox GL JS lẫn MapLibre GL JS với cùng một cách viết code, nên đổi nhà cung cấp dễ dàng.
- Mặc định dùng **Mapbox** (gói miễn phí theo lượt tải, có `worldview=VN`). Phương án dự phòng: **Goong**. Chốt trong tuần đầu dựng nền sau khi chạy kiểm tra hiển thị chủ quyền.
- Gộp ghim thành cụm bằng tính năng cluster có sẵn của nguồn dữ liệu GeoJSON trong thư viện bản đồ.
- **Chỉ đường**: dùng đường dẫn Google Maps (`https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>`), miễn phí, không cần API key [R15].
- **Thời gian di chuyển** cho bộ kiểm tra ràng buộc: GĐ1 ước tính theo khoảng cách đường chim bay × hệ số 1,4 ÷ tốc độ trung bình 20 km/h (xe máy trong nội thành), cộng 10 phút dự phòng. GĐ2 thay bằng API ma trận khoảng cách của nhà cung cấp.
- Dữ liệu địa điểm luôn lấy từ cơ sở dữ liệu của HueTrip; không dùng API địa điểm bên ngoài làm nguồn chính.

Ở GĐ2 thử song song Mapbox, Goong và VIETMAP trong 2 tuần đầu.

## Kiểm tra hiển thị chủ quyền (điều kiện phát hành)

1. Chốt chính xác style và nguồn tile dùng cho bản phát hành.
2. Thử với `language=vi`, `region=VN`, `worldview=VN` nếu nhà cung cấp hỗ trợ.
3. Kiểm tra toàn cảnh Việt Nam và Biển Đông ở các mức zoom đã định.
4. Lưu ảnh chụp màn hình, tên nhà cung cấp, phiên bản và ngày kiểm tra.
5. PO (và bộ phận pháp lý ở GĐ2) ký xác nhận.
6. Yêu cầu nhà cung cấp xác nhận bằng văn bản khi tiêu chí này nằm trong hợp đồng.

Không ghi trong tài liệu rằng nhà cung cấp nào "chắc chắn đúng chủ quyền" khi chưa có hợp đồng hoặc kết quả kiểm tra hình ảnh.

## Tích hợp Claude API

- Dùng để: viết lý do "Hợp với bạn" bằng ngôn ngữ tự nhiên, tóm tắt phương án lịch, diễn giải chênh lệch khi điều chỉnh.
- Không dùng để: quyết định địa điểm có mở cửa không, giá bao nhiêu, lịch có khả thi không. Các giá trị này lấy từ cơ sở dữ liệu và Constraint Engine.
- Đầu vào gửi AI chỉ gồm dữ liệu đã duyệt và reason code, không gửi thông tin định danh người dùng.
- Có cơ chế dự phòng: AI lỗi hoặc quá thời gian thì dùng câu mẫu theo reason code.
- Khóa API chỉ nằm ở backend.
- Lưu kết quả lý do đã sinh theo cặp (địa điểm, tổ hợp sở thích) để dùng lại, tránh gọi AI lặp lại và tiết kiệm chi phí.
- Chọn mô hình nhỏ, chi phí thấp cho việc viết lý do ngắn; kiểm tra bảng giá hiện hành tại tài liệu của Anthropic trước khi chọn [R17].

## Tích hợp dữ liệu thời tiết (tùy chọn GĐ1)

- Nguồn: **Open-Meteo**, dự báo theo giờ, không cần API key; gói miễn phí dành cho mục đích phi thương mại (phù hợp khóa luận; khi thương mại hóa phải chuyển gói hoặc nhà cung cấp) [R13].
- Biến dùng: `precipitation_probability`, `precipitation`, theo múi giờ `Asia/Ho_Chi_Minh`, tọa độ trung tâm Huế.
- Gọi qua `WeatherProvider Adapter` với hai cài đặt: `OpenMeteoProvider` và `SimulatedProvider` (chế độ demo).
- Lưu bộ nhớ đệm dự báo 60 phút; không gọi API mỗi lần người dùng mở màn hình.

# Giao diện lập trình (API)

| Phương thức | Endpoint | Mục đích | Giai đoạn |
|---|---|---|---|
| GET | `/api/map/places?bbox=&layers=&filters=` | Ghim và danh sách cho Hue Map | GĐ1 |
| GET | `/api/places/{id}` | Chi tiết địa điểm | GĐ1 |
| GET | `/api/places/{id}/match?tripId=` | Nhãn "Hợp với bạn" + lý do | GĐ1 |
| POST | `/api/trips` | Tạo chuyến đi | GĐ1 |
| POST | `/api/trips/{id}/generate` | Sinh phương án | GĐ1 |
| POST | `/api/trips/{id}/items` | Thêm điểm từ bản đồ | GĐ1 |
| GET | `/api/trips/{id}/suggestions?type=food\|stay` | Gợi ý ăn, ở theo tuyến | GĐ1 |
| GET | `/api/trips/{id}/versions` | Lịch sử phiên bản | GĐ2 |
| POST | `/api/trips/{id}/adjustments` | Sinh phương án điều chỉnh (F2) | GĐ2 |
| POST | `/api/adjustments/{id}/apply` | Áp dụng phương án | GĐ2 |
| POST | `/api/trips/{id}/members` | Mời thành viên | GĐ2 |
| POST | `/api/proposals/{id}/votes` | Bình chọn | GĐ2 |
| GET | `/api/events?from=&to=&bbox=` | Sự kiện, hoạt động đêm | GĐ2 |
| GET | `/api/experiences` | Trải nghiệm địa phương | GĐ2 |
| POST | `/api/experiences/{id}/requests` | Gửi yêu cầu tham gia | GĐ2 |
| POST | `/api/quests/{id}/verify` | Xác minh Quest | GĐ2 |
| POST | `/api/vouchers/{id}/redeem` | Đổi voucher (nguyên tử, chống gửi lặp) | GĐ2 |
| POST | `/api/media/upload-url` | Lấy URL tải ảnh có ký | GĐ2 |
| POST | `/api/memories` | Tạo album, chứng nhận | GĐ2 |
| POST | `/api/privacy/consents` | Ghi nhận / rút lại đồng ý | GĐ1 |
| POST | `/api/privacy/export` | Xuất dữ liệu cá nhân | GĐ2 |
| DELETE | `/api/me` | Yêu cầu xóa tài khoản | GĐ2 |
| GET | `/api/trips/{id}/weather-alerts` | Cảnh báo mưa cho các mục trong lịch | GĐ1 (tùy chọn) |
| POST | `/api/trips/{id}/weather-alerts/{alertId}/apply` | Áp dụng phương án đổi lịch do mưa | GĐ1 (tùy chọn) |
| GET / POST | `/api/admin/places` | Danh sách, thêm địa điểm (`admin`, `editor`) | GĐ1 |
| PATCH / DELETE | `/api/admin/places/{id}` | Sửa, xuất bản, ẩn, xóa địa điểm | GĐ1 |
| POST | `/api/admin/places/import` | Nhập CSV | GĐ1 |
| GET / PATCH | `/api/admin/users/{id}/role` | Xem, đổi vai trò (`admin`) | GĐ1 |
| GET | `/api/admin/audit-logs` | Nhật ký thao tác (`admin`) | GĐ1 |
| POST | `/api/admin/demo/simulate-rain` | Bật/tắt giả lập trời mưa (`admin`) | GĐ1 (tùy chọn) |
| CRUD | `/api/admin/*` (các chức năng khác) | Đối tác, Quest, voucher, đối soát | GĐ2 |

**Quy ước mã lỗi**

| Mã HTTP | Trường hợp |
|---|---|
| 400 | Dữ liệu đầu vào không hợp lệ |
| 401 / 403 | Chưa đăng nhập / không đủ quyền |
| 404 | Không tìm thấy |
| 409 | Xung đột: trùng điểm, chồng giờ, sai số phiên bản (kèm danh sách xung đột) |
| 422 | Vi phạm quy tắc nghiệp vụ: voucher đã dùng, hết hạn |
| 429 | Vượt giới hạn tần suất |
| 503 | Dịch vụ ngoài (bản đồ, AI) tạm lỗi; trả kết quả dự phòng nếu có |

Mọi phản hồi lỗi có dạng `{ code, message, requestId, details? }`.

# Yêu cầu phi chức năng

| Mã | Nhóm | Yêu cầu | GĐ1 | Pilot (GĐ2) |
|---|---|---|---|---|
| NFR-01 | Hiệu năng web | Trang chính đạt mức "tốt" của Core Web Vitals ở phân vị 75: LCP ≤ 2,5 s; INP ≤ 200 ms; CLS ≤ 0,1 [R9] | Nên đạt | Bắt buộc |
| NFR-02 | Hiệu năng bản đồ | Sau khi ngừng kéo/zoom và chờ 300–500 ms, kết quả trả về ở phân vị 95 ≤ 1,5 s | Bắt buộc | Bắt buộc |
| NFR-03 | Backend | API đọc nội bộ ở phân vị 95 ≤ 800 ms (không tính AI và dịch vụ ngoài); chỉ thử lại với thao tác idempotent | Nên đạt | Bắt buộc |
| NFR-04 | AI | Có phản hồi trạng thái hữu ích ≤ 3 s; gợi ý đầy đủ ở phân vị 95 ≤ 12 s; có dự phòng khi lỗi; lưu phiên bản quy tắc/mô hình | Bắt buộc | Bắt buộc |
| NFR-05 | Độ sẵn sàng | 99,5% trong pilot; bản đồ lỗi vẫn xem được lịch và danh sách | Không áp dụng | Bắt buộc |
| NFR-06 | Bảo mật | HTTPS; phân quyền theo vai trò ở backend và Row Level Security ở cơ sở dữ liệu; khóa bí mật chỉ ở server (không có tiền tố `NEXT_PUBLIC_`); giới hạn tần suất API gọi AI; nhật ký kiểm toán | Bắt buộc | Bắt buộc |
| NFR-07 | Bảo mật nâng cao | MFA cho admin; URL ảnh có ký; kiểm chứng theo OWASP ASVS [R10] | Không áp dụng | Bắt buộc |
| NFR-08 | Khóa bản đồ | Khóa dịch vụ nằm ở backend; token hiển thị bị giới hạn theo tên miền và hạn mức [R3] | Bắt buộc | Bắt buộc |
| NFR-09 | Ảnh / media | Giới hạn loại và dung lượng; mặc định xóa GPS trong EXIF; tạo ảnh thu nhỏ WebP/AVIF | Không áp dụng | Bắt buộc |
| NFR-10 | Khả năng tiếp cận | Mục tiêu WCAG 2.2 mức AA [R11] | Cơ bản (tương phản, bàn phím, nhãn) | Bắt buộc |
| NFR-11 | Giám sát | Mã yêu cầu xuyên suốt, tỷ lệ lỗi, độ trễ p95, hạn mức và chi phí API, tỷ lệ lỗi AI, bất thường voucher | Nhật ký cơ bản | Bắt buộc |
| NFR-12 | Sao lưu | RPO ≤ 24 giờ, RTO ≤ 4 giờ; diễn tập khôi phục trước pilot | Sao lưu tự động của nhà cung cấp DB | Bắt buộc |
| NFR-13 | Bản địa hóa | UTF-8, tiếng Việt chuẩn, múi giờ Asia/Ho_Chi_Minh, VND; lưu thời gian dạng timestamptz | Bắt buộc | Bắt buộc |
| NFR-14 | Khả dụng | Người dùng mới hoàn thành luồng "mở bản đồ → thêm 3 điểm vào lịch" trong ≤ 5 phút không cần hướng dẫn; SUS ≥ 68 | Bắt buộc | Bắt buộc |
| NFR-15 | Tương thích | Chạy trên Chrome, Safari, Edge bản mới; màn hình từ 360 px | Bắt buộc | Bắt buộc |

# Yêu cầu về quyền riêng tư

## Căn cứ

- Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15, hiệu lực từ 01/01/2026, quy định các quyền của chủ thể dữ liệu: được biết, đồng ý và rút lại đồng ý, truy cập, chỉnh sửa, yêu cầu cung cấp, xóa, hạn chế xử lý [R7].
- Nghị định 330/2026/NĐ-CP (hiệu lực 19/08/2026) quy định xử phạt, trong đó có trường hợp xử lý dữ liệu khi chưa có đồng ý hợp lệ hoặc không lưu được bằng chứng đồng ý [R8].
- GDPR chỉ là yêu cầu pháp lý đầy đủ nếu HueTrip phục vụ hoặc theo dõi người dùng tại EU; việc này **chưa xác định** và cần rà soát pháp lý. Tuy vậy, các nguyên tắc giới hạn mục đích, tối thiểu hóa dữ liệu, giới hạn lưu trữ và bảo vệ dữ liệu ngay từ thiết kế (Điều 5, Điều 25 GDPR) được dùng làm chuẩn thiết kế [R12].

## Yêu cầu

| Mã | Yêu cầu | Giai đoạn |
|---|---|---|
| PR-01 | Có **sổ ghi nhận đồng ý** (consent ledger), không chỉ một ô tích trên giao diện. Mỗi bản ghi gồm: `user_id`, `purpose`, `data_categories`, `policy_version`, `status`, `granted_at`, `withdrawn_at`, `evidence`. | GĐ1 |
| PR-02 | Không xin quyền vị trí ngay khi mở app; chỉ xin khi người dùng bấm "Gần tôi", chỉ đường hoặc check-in. | GĐ1 |
| PR-03 | Tách "dùng vị trí một lần" với theo dõi nền. | GĐ1 |
| PR-04 | Không lưu lịch sử GPS chỉ để cá nhân hóa nếu không cần. | GĐ1 |
| PR-05 | Xác minh Quest chỉ giữ bằng chứng tối thiểu, không lưu toàn bộ đường đi. | GĐ2 |
| PR-06 | Khi chia sẻ Memory, mặc định xóa metadata GPS của ảnh. | GĐ2 |
| PR-07 | Người dùng xuất được dữ liệu của mình và yêu cầu xóa tài khoản. | GĐ2 |
| PR-08 | Có danh sách bên xử lý dữ liệu (nhà cung cấp bản đồ, AI, hosting) và thời gian lưu trữ theo từng loại dữ liệu. | GĐ2 |

# Kiểm thử và truy vết

## Ma trận truy vết (phần GĐ1)

| Quy tắc (BRD) | Yêu cầu | Tiêu chí chấp nhận | Use case | Ca kiểm thử |
|---|---|---|---|---|
| BR-MAP-01, BR-MAP-02 | FR-F8-01 → 04 | AC-F8.1-01 → 04 | UC-02 | TC-MAP-01 → 06 |
| BR-MAP-02 | FR-F8-05, 06, 07 | AC-F8.2-01 → 04 | UC-02, UC-03 | TC-FLT-01 → 05 |
| BR-MAP-04, BR-VERSION-01 | FR-F8-08, 09 | AC-F8.3-01 → 04 | UC-05 | TC-ADD-01 → 06 |
| BR-MAP-03 | FR-F8-10 | AC-F8.4-01 → 04 | UC-03 | TC-MATCH-01 → 05 |
| BR-TRIP-01, BR-PREF-01, BR-FEAS-01 | FR-F1-01 → 04 | AC-F1-01 → 04 | UC-01, UC-04 | TC-TRIP-01 → 06 |
| BR-PRICE-01, BR-MAP-05 | FR-F3-01 → 03 | AC-F3-01 → 04 | UC-06 | TC-SUG-01 → 05 |
| BR-SOURCE-01 | FR-SUP-01 | AC-SUP-02, AC-SUP-04 | UC-14 | TC-DATA-01 → 03 |
| BR-PRIVACY-01 | PR-01 → 04 | – | UC-15 | TC-PRV-01 → 04 |
| SEC-ROLE-01 → 06 | FR-ADM-05, 06 | AC-ROLE-01 → 05 | UC-17 | TC-ROLE-01 → 05 |
| BR-SOURCE-01, BR-MAP-01 | FR-ADM-01 → 04 | AC-ADM-01 → 03 | UC-14 | TC-ADM-01 → 04 |
| BR-F2-01, BR-F2-02 (tùy chọn) | FR-F2-04 → 07 | AC-F2-06 → 10 | UC-16 | TC-RAIN-01 → 05 |

## Định nghĩa hoàn thành

**GĐ1 – Demo khóa luận:** toàn bộ tiêu chí chấp nhận của F8.1–F8.4, F1 (cá nhân), F3 đạt; không còn lỗi nghiêm trọng mức 1–2; dữ liệu 20–30 điểm đạt ngưỡng chất lượng; ứng dụng chạy online có đường link; có kết quả đánh giá với 10–15 người dùng.

**GĐ2 – Pilot:** các luồng P1 chạy xuyên suốt và đạt tiêu chí chấp nhận; không còn lỗi mức 1–2; điều kiện quyền riêng tư và hiển thị bản đồ đã được ký xác nhận; dữ liệu pilot đạt ngưỡng chất lượng; giám sát và khôi phục hoạt động; có biên bản nghiệm thu.

## Sự kiện phân tích tối thiểu

| Sự kiện | Khi nào ghi | Dùng cho KPI |
|---|---|---|
| `sample_trip_viewed` | Xem lịch mẫu | Kích hoạt |
| `trip_created` / `trip_saved` | Tạo / lưu chuyến | Kích hoạt |
| `map_layer_toggled` | Bật/tắt lớp | Hành vi bản đồ |
| `place_card_opened` | Mở thẻ địa điểm | Bản đồ → Lịch |
| `match_reason_viewed` | Xem lý do "Hợp với bạn" | Hiệu quả cá nhân hóa |
| `item_added_from_map` | Thêm điểm từ bản đồ | Bản đồ → Lịch |
| `conflict_shown` / `conflict_resolved` | Hiện / xử lý xung đột | Chất lượng lịch |
| `direction_clicked` | Bấm chỉ đường | Chuyển đổi địa phương |
| `voucher_issued` / `voucher_redeemed` | Phát / dùng voucher | Quest (GĐ2) |
| `plan_selected` | Chọn 1 trong 3 phương án | Chất lượng gợi ý |
| `rain_alert_shown` / `rain_alert_applied` | Hiện / áp dụng cảnh báo mưa | Điều chỉnh (tùy chọn) |

# Triển khai sản phẩm mẫu (GĐ1)

Chương này là hướng dẫn để bắt đầu xây dựng website demo. Mọi lựa chọn ở đây đều ưu tiên: **miễn phí, ít cấu hình, một người làm được**.

## Công cụ và dịch vụ tích hợp

**Bắt buộc cho GĐ1**

| Nhóm | Công cụ | Dùng để làm gì | Chi phí / lưu ý |
|---|---|---|---|
| Khung ứng dụng | **Next.js** (App Router) + **TypeScript** | Giao diện + API (Route Handlers) trong cùng một dự án | Miễn phí |
| Giao diện | **Tailwind CSS** + **shadcn/ui** + icon **lucide-react** | Dựng nhanh nút, thẻ, ngăn kéo, form theo wireframe | Miễn phí |
| Cơ sở dữ liệu | **Supabase** (PostgreSQL + PostGIS) | Lưu địa điểm, chuyến đi; truy vấn theo vùng bản đồ | Gói miễn phí; dự án lâu không hoạt động có thể bị tạm dừng, **mở lại trước hôm bảo vệ** |
| Đăng nhập, phân quyền | **Supabase Auth** + **Row Level Security** | Đăng ký, đăng nhập, vai trò, chặn truy cập trái phép | Có trong gói miễn phí |
| Lưu ảnh | **Supabase Storage** | Ảnh địa điểm | Có trong gói miễn phí |
| Bản đồ | **react-map-gl** + **Mapbox** (dự phòng: Goong) | Hiển thị bản đồ, ghim, cụm, tuyến | Gói miễn phí theo lượt tải; phải kiểm tra hiển thị chủ quyền |
| Chỉ đường | **Đường dẫn Google Maps** | Nút "Chỉ đường" | Miễn phí, không cần key |
| AI | **Claude API** (thư viện `@anthropic-ai/sdk`) | Viết lý do "Hợp với bạn", tóm tắt phương án | Tính phí theo lượng dùng; cần nạp một khoản nhỏ; dùng bộ nhớ đệm để tiết kiệm |
| Lấy dữ liệu, form | **TanStack Query**, **React Hook Form** + **Zod** | Gọi API bản đồ, kiểm tra dữ liệu nhập | Miễn phí |
| Triển khai | **Vercel** | Đưa web lên mạng, có đường link | Gói Hobby miễn phí cho dự án cá nhân, phi thương mại |
| Mã nguồn | **GitHub** | Lưu code, lịch sử, nộp kèm khóa luận | Miễn phí |
| Thiết kế | **Figma** | Wireframe, prototype để phỏng vấn | Gói Education miễn phí |

**Nên có (làm nếu kịp)**

| Nhóm | Công cụ | Dùng để làm gì | Chi phí / lưu ý |
|---|---|---|---|
| Thời tiết | **Open-Meteo** | Dự báo mưa cho F2 rút gọn | Miễn phí, phi thương mại, không cần key |
| Phân tích hành vi | **PostHog** hoặc **Vercel Analytics** | Ghi các sự kiện phân tích (bảng ở trên) để đo KPI | Có gói miễn phí |
| Theo dõi lỗi | **Sentry** | Biết khi web bị lỗi lúc người dùng thử | Có gói miễn phí |
| Kiểm thử | **Vitest** (logic), **Playwright** (luồng giao diện) | Chạy ca kiểm thử theo tiêu chí chấp nhận | Miễn phí |
| Khảo sát | **Google Forms** | Bảng hỏi TAM, SUS sau khi dùng thử | Miễn phí |
| Hỗ trợ code | **Claude Code** trong VSCode | Viết code theo SRS | Theo gói Claude đang dùng |

## Cấu trúc thư mục đề xuất

```
huetrip/
  app/
    (traveler)/
      onboarding/         UX-01 Sở thích
      plans/              UX-04 3 phương án
      map/                UX-02, UX-03 Hue Map + thẻ
      trip/[id]/          UX-06 Lịch ngày, UX-07 ăn ở
      login/              UX-08
    admin/                UX-A1 → A5 (chỉ admin)
    api/                  Route Handlers theo chương API
  lib/
    map/                  MapProvider adapter
    weather/              WeatherProvider adapter
    reco/                 chấm điểm + reason code
    constraints/          kiểm tra giờ mở cửa, chồng giờ, di chuyển
    ai/                   gọi Claude API + câu mẫu dự phòng
    supabase/             client, kiểu dữ liệu
  supabase/
    migrations/           tạo bảng, RLS, trigger AUDIT_LOG
    seed/places.csv       20–30 điểm Huế
  docs/                   BRD, SRS, sơ đồ
  tests/
```

## Biến môi trường

| Tên biến | Ở đâu | Ghi chú |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Trình duyệt + server | Khóa công khai, an toàn khi đã bật RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Chỉ server | Tuyệt đối không đưa lên trình duyệt hay GitHub |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Trình duyệt | Giới hạn theo tên miền trong trang quản lý Mapbox |
| `ANTHROPIC_API_KEY` | Chỉ server | Đặt giới hạn chi tiêu trong trang quản lý |
| `WEATHER_PROVIDER` | Server | `open-meteo` hoặc `simulated` |

Lưu trong file `.env.local` (đã thêm vào `.gitignore`) và khai báo lại trên Vercel. Đưa lên GitHub file `.env.example` chỉ chứa tên biến.

## Dữ liệu mẫu

File `supabase/seed/places.csv`, mỗi dòng một địa điểm:

| Cột | Ví dụ |
|---|---|
| name | Lăng Khải Định |
| layer | heritage |
| lodging_type | (để trống nếu không phải lưu trú) |
| lat, lng | 16.3990, 107.5904 |
| opening_hours | `{"mon-sun":"07:00-17:30"}` |
| visit_duration_min | 60 |
| price_min_vnd, price_max_vnd | 150000, 150000 |
| price_status | estimated |
| indoor | false |
| highlight_tags | architecture;photo_spot |
| description | Lăng có nội thất khảm sành sứ… |
| source | Trang chính thức Trung tâm Bảo tồn Di tích Cố đô Huế |
| updated_at | 2026-10-25 |

**Cơ cấu gợi ý 25 điểm:** 8 di tích, 4 điểm du lịch, 7 ăn uống (có 2 quán chay), 6 lưu trú (3 khách sạn, 3 homestay). Tọa độ và giờ mở cửa ở ví dụ trên chỉ minh họa định dạng; **phải tra cứu và ghi nguồn thật cho từng điểm** trước khi nhập.

## Thứ tự xây dựng

| Tuần | Việc | Hoàn thành khi |
|---|---|---|
| 6 | Tạo dự án Next.js, kết nối Supabase, tạo bảng + RLS, nạp dữ liệu mẫu, bản đồ hiển thị ghim; chạy kiểm tra hiển thị chủ quyền và chốt nhà cung cấp bản đồ | Mở web thấy bản đồ Huế có 25 ghim; AC-ROLE-02 đạt |
| 7 | Chip lớp, bộ lọc, cụm ghim, ngăn kéo danh sách, thẻ địa điểm, nút Chỉ đường; trang Admin danh sách + form địa điểm | AC-F8.1-01 → 06, AC-F8.2-01 → 06, AC-ADM-01 → 03 đạt |
| 8 | Đăng nhập, màn Sở thích, sinh 3 phương án, chấm điểm + reason code, "Hợp với bạn", Thêm vào lịch + kiểm tra xung đột, Lịch ngày | Chạy trọn luồng tổng thể GĐ1; AC-F1, AC-F8.3, AC-F8.4 đạt |
| 9 | Gợi ý ăn/ở (F3), gọi Claude API viết lý do, đưa lên Vercel; nếu kịp: cảnh báo mưa + giả lập | Có đường link chạy trên điện thoại; AC-F3 đạt |
| 10–11 | Kiểm thử theo ma trận truy vết, sửa lỗi, cho 10–15 người dùng thử | Không còn lỗi mức 1–2; có dữ liệu SUS, TAM |

**Nguyên tắc:** làm xong một luồng chạy được rồi mới làm đẹp. Nếu chậm tiến độ, cắt theo thứ tự trong BRD: F3 → AI viết lý do (thay bằng câu mẫu) → bộ lọc nâng cao → F2 rút gọn.

## Kịch bản trình diễn (5 phút)

1. Mở web trên điện thoại, chọn sở thích "Di tích + Chụp ảnh", 2 ngày, đi cùng gia đình.
2. So sánh 3 phương án, chọn "Cân bằng khám phá", xem lịch hiện trên Hue Map.
3. Bật lớp Lưu trú → lọc Homestay → mở thẻ, chỉ ra lý do "Hợp với bạn" và nguồn dữ liệu.
4. Thêm Lăng Khải Định vào 17:00 → hệ thống báo xung đột giờ đóng cửa → chọn khung giờ gợi ý.
5. (Nếu có F2) Admin bật "Giả lập trời mưa" → lịch hiện cảnh báo → áp dụng phương án điểm trong nhà.
6. Mở trang Admin: sửa giờ mở cửa một địa điểm, chỉ ra nhật ký thao tác.

# Tài liệu tham khảo

**Tài liệu nội bộ**

- [TL1] HueTrip AI – Thiết kế chức năng và mô hình kinh doanh, 07/10/2026.
- [TL2] Product Specification v1 – Digital Local Guide.
- BRD HueTrip AI v1.0, 15/10/2026.
- [TL3] Wireframe Figma `HueTrip – Wireframe`, các frame 01–07.

**Nguồn bên ngoài** (tra cứu ngày 14/10/2026; cần kiểm tra lại trước khi ra quyết định)

- [R1] Mapbox – Bảng giá: https://www.mapbox.com/pricing ; Worldview: https://docs.mapbox.com/help/glossary/worldview/
- [R2] Goong – Bảng giá: https://goong.io/bang-gia/
- [R3] VIETMAP – Tổng quan Map API: https://maps.vietmap.vn/docs/map-api/overview/
- [R4] Google Maps Platform – Bảng giá: https://developers.google.com/maps/billing-and-pricing/pricing ; Bản địa hóa bản đồ: https://developers.google.com/maps/documentation/javascript/localization
- [R5] OpenStreetMap – Chính sách sử dụng tile: https://operations.osmfoundation.org/policies/tiles/
- [R6] Wanderlog (sản phẩm tham khảo): https://wanderlog.com/
- [R7] Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15: https://congbao.chinhphu.vn/van-ban/luat-so-91-2025-qh15-45578.htm
- [R8] Nghị định 330/2026/NĐ-CP: https://congbao.chinhphu.vn/van-ban/nghi-dinh-so-330-2026-nd-cp-470339/67933.htm
- [R9] web.dev – Ngưỡng Core Web Vitals: https://web.dev/articles/defining-core-web-vitals-thresholds
- [R10] OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- [R11] W3C – WCAG 2.2: https://www.w3.org/TR/WCAG22/
- [R12] GDPR – Quy định (EU) 2016/679: https://eur-lex.europa.eu/eli/reg/2016/679
- [R13] Open-Meteo – Tài liệu API và điều khoản: https://open-meteo.com/en/docs ; https://open-meteo.com/en/terms
- [R14] Supabase – Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security ; PostGIS: https://supabase.com/docs/guides/database/extensions/postgis
- [R15] Google Maps URLs (đường dẫn chỉ đường): https://developers.google.com/maps/documentation/urls/get-started
- [R16] react-map-gl: https://visgl.github.io/react-map-gl/
- [R17] Tài liệu Claude API (Anthropic): https://docs.claude.com
