# AnLaundry CRM

CRM vận hành riêng cho AnLaundry. Thư mục này độc lập với website marketing ở repository root.

## Kiến trúc
- Frontend: HTML/CSS/JavaScript module, Supabase JS v2.
- Authentication: Supabase Auth.
- Database: Supabase PostgreSQL + Row Level Security (RLS).
- Hosting: GitHub Pages tại đường dẫn /crm/ sau khi cấu hình triển khai.

## Thiết lập Supabase
1. Tạo project riêng trên Supabase.
2. Mở SQL Editor và chạy toàn bộ `schema.sql`.
3. Tạo user đầu tiên trong Authentication.
4. Cấp role owner cho user đầu tiên bằng câu SQL bootstrap ở cuối schema.sql.
5. Tạo thêm user cho nhân viên trong Supabase Auth; trigger tự tạo profile với role staff.
6. Cập nhật `config.js` bằng Project URL và publishable/anon key. Chỉ dùng key công khai; không bao giờ dùng service_role key ở frontend.

## Triển khai
CRM chưa được đưa lên domain production. Sau khi kiểm thử Supabase, cấu hình GitHub Pages để phục vụ thư mục `crm/` tại `https://www.anlaundry.com/crm/`. Không thay thế `index.html` ở thư mục gốc.

## Giai đoạn hiện tại
Khởi tạo cấu trúc, giao diện đăng nhập và schema nền tảng. Các màn hình nghiệp vụ CRUD, báo cáo, kiểm thử RLS và quy trình backup cần hoàn thiện trước khi sử dụng dữ liệu khách hàng thật.
