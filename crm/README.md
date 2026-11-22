# AnLaundry CRM

CRM vận hành đa chi nhánh, tách biệt với website marketing ở thư mục gốc.

## Kiến trúc hiện tại
- Frontend: HTML/CSS/JavaScript module, Supabase JS v2.
- Auth: Supabase Auth.
- Database: Supabase PostgreSQL với Row Level Security (RLS).
- Source control: nhánh `crm-development`; không sửa website marketing trên `main`.
- Đường dẫn dự kiến sau khi triển khai: `https://www.anlaundry.com/crm/`. Cổng khách hàng dự kiến: `https://www.anlaundry.com/account/`.

## Quyết định nghiệp vụ
- Khách hàng dùng chung toàn hệ thống.
- Nhân viên muốn làm tại chi nhánh khác phải gửi yêu cầu và được duyệt; quyền truy cập chỉ có hiệu lực trong khoảng thời gian được duyệt.
- Danh mục dịch vụ chung, bảng giá riêng theo từng chi nhánh.
- Đơn hàng lưu chi nhánh thực tế tiếp nhận; chi tiết đơn lưu snapshot giá tại thời điểm tạo.
- Thanh toán hỗ trợ tiền mặt và chuyển khoản; báo cáo phân biệt doanh thu theo đơn với tiền thực thu.

Xem chi tiết tại [ARCHITECTURE.md](./ARCHITECTURE.md).

## Thiết lập Supabase
- Project Development đã được khai báo trong `crm/config.js` bằng Project URL và publishable key.
- Chưa xác nhận database schema đã được chạy; chưa tạo owner, chi nhánh hoặc dữ liệu nghiệp vụ.

## Thiết lập database — đang chờ thao tác trong Dashboard
1. Tạo project Supabase riêng cho AnLaundry.
2. Chỉ sau khi rà soát schema và chuẩn bị project trống, chạy `schema.sql` trong SQL Editor.
3. Tạo Auth user đầu tiên và thêm hồ sơ owner bằng câu bootstrap trong schema. Không bật public employee signup.
4. Tạo chi nhánh và phân công owner/manager/staff.
5. Tạo bảng giá cho từng chi nhánh trong `branch_service_prices`.
6. Cấu hình client đã được ghi vào `config.js`. Sau khi chạy schema và bật RLS đúng, publishable key có thể nằm trong frontend.
7. Tuyệt đối không đưa `service_role` key, database password hoặc secret vào GitHub/frontend.

## Trạng thái triển khai
Đây mới là thiết kế database nền tảng và mã khởi tạo. Chưa có project Supabase được kết nối, chưa có dữ liệu thật, chưa hoàn thiện giao diện POS, cổng khách hàng, báo cáo, RPC tạo đơn an toàn, kiểm thử RLS hay backup. Không dùng cho vận hành thật trước khi hoàn thành checklist production.

## Lộ trình
1. **Foundation:** duyệt schema, tạo Supabase dev, chạy schema, tạo owner/chi nhánh/nhân sự/bảng giá.
2. **Security:** viết và chạy ma trận test RLS cho 4 vai trò và các tình huống chi nhánh.
3. **Staff CRM:** đăng nhập, chọn chi nhánh được cấp quyền, yêu cầu hỗ trợ, khách hàng, đơn hàng, thanh toán, chi phí.
4. **Customer portal:** liên kết tài khoản đã xác minh, chỉ xem đơn của chính khách hàng.
5. **Reports:** doanh thu toàn hệ thống, theo chi nhánh, phương thức thanh toán, chi phí và công nợ.
6. **Pilot & release:** nhập dữ liệu mẫu, UAT tại một chi nhánh, backup/restore test, sau đó mới cấu hình GitHub Pages và merge có kiểm soát.

## Lưu ý
`schema.sql` là bản khởi tạo cho Supabase project mới, không phải migration tự động cho database đang có dữ liệu. Cần rà soát và kiểm thử trên project development trước khi chạy production.


## Quản lý nhân sự
- Giao diện danh sách nhân sự nằm trong CRM và chỉ hiện cho Owner/Manager.
- Thêm nhân viên gọi Edge Function `admin-create-employee`; hàm xác thực JWT và quyền quản lý chi nhánh trước khi mời Auth user, tạo hồ sơ và phân công.
- Edge Function dùng `SUPABASE_SERVICE_ROLE_KEY` ở môi trường server Supabase; không đặt khóa này trong `crm/config.js` hay bất kỳ mã frontend nào.
- Cần triển khai hàm bằng Supabase CLI: `supabase functions deploy admin-create-employee`. Các secret mặc định của Supabase Edge Functions cần sẵn có trong môi trường. Email mời phụ thuộc cấu hình Email Auth/SMTP của project.
- Chưa triển khai Edge Function lên Supabase và chưa thể gửi lời mời nhân viên từ giao diện cho đến khi bước deploy hoàn tất.

- Manager visibility is restricted by RLS to employee profiles with an active assignment in branches they manage. Apply `crm/sql/08_RESTRICT_MANAGER_STAFF_VISIBILITY.sql` to an already initialized development database before enabling Manager access to the staff screen.

- Supabase Edge Function source: `supabase/functions/admin-create-employee/index.ts`.
- Deployment steps: see `supabase/DEPLOYMENT.md`. Keep JWT verification enabled.

## Đăng nhập và khôi phục mật khẩu
- CRM hỗ trợ đăng nhập bằng email/mật khẩu, gửi email khôi phục tại màn hình đăng nhập và cập nhật mật khẩu khi Supabase phát sự kiện `PASSWORD_RECOVERY`.
- Liên kết khôi phục dùng `redirectTo` bằng URL trang CRM hiện tại. URL này phải được thêm vào Supabase Authentication → URL Configuration → Redirect URLs.
- Không dùng `http://localhost:3000` làm Site URL cho môi trường preview/production. Chỉ allow-list localhost khi server local thật sự đang chạy.


## Interactive UI demo
- Open the CRM login screen and choose **Trải nghiệm bản demo**.
- Demo modules: overview, orders (create/update status), shared customers (create/edit), payments (cash/bank transfer), monthly reports, staff (add demo staff/activate/deactivate), branches (add demo branch), branch-specific service pricebook, and branch-transfer approval workflow.
- Demo data is stored only in the browser using localStorage key `anlaundry.crm.demo.v1`. It is separate from Supabase and does not create/update real customer, order, payment, staff, branch, or pricing records.
- Use **Đặt lại demo** on the overview page to restore sample data. Use **Thoát demo** to return to real Supabase login.
- To preview locally from `crm-development`: `git pull origin crm-development`, then run a local static server from the repository root (for example `python3 -m http.server 3000`) and open `http://localhost:3000/crm/`.
- This is a front-end workflow prototype for user acceptance testing, not a production-ready transactional system. Production actions must later be wired to Supabase RPC/Edge Functions and protected by RLS.
