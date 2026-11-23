# Kế hoạch cloud cho AN Laundry CRM

Ngày chốt phương án: 23/11/2026  
Nhánh làm việc: `crm-cloud-preview`  
Nhánh SQL đã kiểm thử: `crm-database-preview`

## 1. Quyết định kiến trúc

Giữ nguyên website marketing trên GitHub Pages. Không chuyển website chính sang nhà cung cấp hosting khác trong giai đoạn đầu.

| Thành phần | Nền tảng | Vai trò |
|---|---|---|
| Website và giao diện CRM | GitHub Pages | Phục vụ HTML, CSS, JavaScript |
| Mã nguồn và kiểm thử | GitHub + GitHub Actions | Quản lý phiên bản, test tự động |
| Database | Railway MySQL | Lưu dữ liệu vận hành theo schema MySQL đã kiểm thử |
| Backend API | Railway, Node.js 26 LTS | Xác thực, phân quyền, xử lý nghiệp vụ và truy vấn MySQL |
| Tệp hóa đơn/tài liệu (khi cần) | Object storage riêng | Không lưu file lớn trực tiếp vào database |

Luồng kết nối:

`Trình duyệt → HTTPS API trên Railway → MySQL qua private networking`

Frontend tuyệt đối không kết nối trực tiếp MySQL. Không đưa database password, JWT signing secret hoặc bất kỳ secret backend nào vào GitHub hay JavaScript chạy trên trình duyệt.

## 2. Vì sao chọn Railway ở giai đoạn đầu

- Có template MySQL và triển khai backend trong cùng một project.
- Backend có thể kết nối MySQL qua mạng private nội bộ, không cần mở database ra Internet.
- Có volume bền vững cho MySQL và có thể bật lịch backup.
- Có thể triển khai từ repository GitHub và chuyển workload sang hosting/VPS/MySQL khác về sau mà không phải thay đổi mô hình nghiệp vụ.

Tài liệu chính thức:
- MySQL: https://docs.railway.com/databases/mysql
- Private networking: https://docs.railway.com/networking/private-networking
- Volumes: https://docs.railway.com/volumes
- Backups: https://docs.railway.com/volumes/backups
- Pricing: https://railway.com/pricing

## 3. Chi phí và cách bắt đầu

- Có thể dùng Trial để triển khai thử, không đưa dữ liệu khách hàng thật vào giai đoạn này.
- Free plan hiện có giới hạn tài nguyên, dịch vụ ngủ khi không hoạt động và có thể làm gián đoạn trải nghiệm CRM.
- Khi bắt đầu pilot có người dùng thật, dự kiến cần Railway Hobby (tối thiểu 5 USD/tháng, bao gồm 5 USD usage credit). Nếu mức dùng vượt credit, chi phí sẽ tăng theo CPU/RAM/storage/egress thực tế. Đây không phải cam kết rằng hệ thống sẽ chỉ tốn 5 USD mỗi tháng.
- Paid plan cần phương thức thanh toán hợp lệ. Đặt cảnh báo chi phí và giới hạn mức chi trước khi bật vận hành.

Giá và giới hạn cần được kiểm tra lại tại thời điểm tạo project: https://railway.com/pricing

## 4. Những việc đã có và những việc còn phải làm

### Đã có
- `database/schema.sql` và `database/seed_data.sql` trên `crm-database-preview`.
- Schema được kiểm thử trên MySQL 8.0.16 và 8.0.36 bằng GitHub Actions.
- Thiết kế đã có bảng users/password_hash, roles và user_branch_access để xây xác thực và phân quyền theo chi nhánh.
- Frontend CRM hiện có bản demo giao diện và nghiệp vụ mẫu.

### Phải chuyển đổi trước khi kết nối cloud
Hiện `crm/app.js` và `crm/config.js` còn sử dụng Supabase JS v2, Supabase Auth và PostgreSQL (ví dụ các bảng `profiles`, `staff_branch_assignments`, `branches`, cùng Edge Function `admin-create-employee`). Những phần này không tương thích trực tiếp với schema MySQL mới.

Vì vậy:
1. Giữ nguyên UI, rà soát từng hành động hiện tại.
2. Xây backend REST API dùng Node.js 26 LTS và MySQL driver.
3. Chuyển đăng nhập sang backend; hash mật khẩu bằng Argon2id hoặc bcrypt, token được ký ở server và lưu theo cách an toàn.
4. Chuyển các thao tác nhân viên, chi nhánh, khách hàng, đơn hàng, thanh toán, thu chi và báo cáo sang API.
5. Chỉ bỏ phần kết nối Supabase sau khi chức năng tương ứng đã được chuyển và kiểm thử đầy đủ. Không xóa ngay thư mục `supabase/` hoặc lịch sử mã nguồn.

## 5. Cấu hình Railway dự kiến

Tạo một Railway Project với môi trường riêng tên `preview`, gồm:

- Service `mysql`: dùng MySQL template chính thức; gắn persistent volume vào đúng thư mục dữ liệu MySQL; database chỉ truy cập từ private network.
- Service `api`: deploy từ thư mục backend trong repository; có public HTTPS domain cho API.
- API kết nối database qua private service variables/connection string của Railway; không dùng public TCP proxy giữa hai service cùng project.
- CORS chỉ cho phép origin CRM preview và sau này là origin website chính xác.
- Health endpoint chỉ công bố trạng thái ứng dụng, không trả về credentials, SQL, stack trace hoặc thông tin kết nối.

Không khởi tạo project Railway bằng dữ liệu sản xuất hoặc bí mật được lưu trong GitHub.

## 6. Import database an toàn

Chỉ dùng môi trường `preview` mới, database trống:
1. Tạo MySQL service và xác nhận phiên bản tương thích MySQL 8.0.16+.
2. Import `database/schema.sql` một lần.
3. Import `database/seed_data.sql` một lần.
4. Chạy smoke tests và xác nhận đủ bảng, khóa ngoại, CHECK constraints.
5. Tạo OWNER đầu tiên bằng bootstrap server-side dùng một lần; không commit mật khẩu/hash vào repository.
6. OWNER cấu hình bảng giá riêng cho từng chi nhánh trước khi lập đơn có tính tiền.

Không chạy lại seed trên database đang có dữ liệu. Không thay schema production bằng cách import đè; thay đổi sau này phải dùng migration có phiên bản.

## 7. Yêu cầu bảo mật và vận hành trước pilot

- MySQL không có public endpoint nếu backend có thể dùng private networking.
- Dùng TLS cho truy cập API; bật Helmet, CORS allowlist, rate limit, validation và prepared statements.
- Xác thực quyền ở backend trên từng request; nhân viên chỉ truy cập chi nhánh trong `user_branch_access`; chỉ OWNER được sửa bảng giá theo quy tắc hiện tại.
- Tạo đơn, chi tiết đơn và số tiền trong một transaction; server tự tính tổng từ order items.
- Kiểm tra khoảng hiệu lực giá trong transaction có khóa; không tin đơn giá do trình duyệt gửi.
- Ghi audit log cho thay đổi giá, giảm giá, tổng tiền, thanh toán, phân quyền và thu chi.
- Bật backup hằng ngày, kiểm tra backup và thực hiện ít nhất một lần restore thử trước khi có dữ liệu thật.
- Không dùng dữ liệu cá nhân thật để kiểm thử quyền truy cập; dùng tài khoản và dữ liệu giả lập.
- Không lưu thông tin thẻ thanh toán hoặc dữ liệu bí mật khác của khách trong CRM.

## 8. Lộ trình chuyển sang hosting khi mở rộng

Vì backend chỉ giao tiếp với MySQL qua cấu hình môi trường và API contract, về sau có thể:
1. Xuất MySQL bằng `mysqldump` và khôi phục trên MySQL của hosting/VPS.
2. Chuyển biến môi trường backend sang host/database mới.
3. Chuyển backend Node.js sang hosting hỗ trợ Node.js hoặc VPS.
4. Giữ website GitHub Pages hoặc chuyển riêng nếu có lý do thực tế.
5. Kiểm tra backup/restore, SSL, domain, CORS, DNS và kiểm thử nghiệp vụ trước khi đổi traffic.

Thiết kế này tránh khóa cứng hệ thống vào Railway.

## 9. Phạm vi triển khai ở nhánh preview

Nhánh `crm-cloud-preview` chỉ dùng để xây dựng và kiểm thử. Không sửa `main`, không thay đổi website đang công khai, không import dữ liệu thật và không kết nối database sản xuất nếu chưa có một đợt phát hành được duyệt riêng.
