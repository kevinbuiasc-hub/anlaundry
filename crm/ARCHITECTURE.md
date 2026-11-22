# AnLaundry CRM — kiến trúc multi-branch

## Quyết định đã chốt
1. **Customer master shared:** một hồ sơ khách hàng toàn hệ thống; mã khách hàng và số điện thoại chuẩn hóa dùng để tìm/ghép hồ sơ. Khách có thể phát sinh đơn tại mọi chi nhánh.
2. **Branch switching requires approval:** nhân viên chỉ truy cập chi nhánh có phân công còn hiệu lực. Yêu cầu hỗ trợ chi nhánh khác phải được owner hoặc manager của chi nhánh đích duyệt. Duyệt tạo phân công tạm thời có thời hạn.
3. **Separate branch price books:** danh mục dịch vụ chung, giá riêng theo chi nhánh. Mỗi order item lưu tên dịch vụ, đơn vị và đơn giá snapshot để bảo toàn lịch sử.

## Mô hình dữ liệu
- `branches`: danh mục chi nhánh.
- `profiles`: tài khoản nhân sự và vai trò owner / manager / staff; không nhận role từ public signup.
- `staff_branch_assignments`: chi nhánh chính và các phân công tạm thời có hiệu lực theo thời gian.
- `branch_switch_requests`: yêu cầu đổi/đến hỗ trợ chi nhánh; chỉ RPC `review_branch_switch_request` mới phê duyệt và tạo assignment.
- `customers`: hồ sơ khách hàng dùng chung; `phone_normalized` unique để giảm trùng.
- `customer_accounts`: ánh xạ Auth user với đúng một customer; việc liên kết tài khoản cần quy trình xác minh/được nhân viên có quyền thực hiện.
- `services` + `branch_service_prices`: catalog chung và bảng giá riêng từng chi nhánh, có khoảng hiệu lực.
- `orders`: luôn có `branch_id`, `customer_id`, `created_by`.
- `order_items`: snapshot tên dịch vụ/đơn vị/đơn giá tại thời điểm lập đơn.
- `payments`: lưu chi nhánh thu tiền, người nhận, phương thức cash / bank_transfer và trạng thái.
- `expenses`: chi phí theo chi nhánh.
- `activity_logs`: dấu vết thao tác.

## Quy tắc phân quyền
| Vai trò | Phạm vi |
|---|---|
| Owner | Toàn hệ thống; quản lý chi nhánh, nhân sự, phân công, bảng giá; xem báo cáo hợp nhất và từng chi nhánh |
| Manager | Dữ liệu vận hành tại các chi nhánh được phân công; quản lý giá, chi phí và duyệt yêu cầu hỗ trợ vào chi nhánh mình quản lý |
| Staff | Tạo/cập nhật đơn và ghi nhận thanh toán tại chi nhánh được phân công; không tự cấp quyền chi nhánh, không sửa bảng giá |
| Customer | Chỉ xem hồ sơ, đơn hàng, chi tiết và thanh toán thuộc customer_id đã liên kết |

RLS là lớp bắt buộc ở database; ẩn nút trên giao diện không thay thế phân quyền. Không cho phép người dùng tự chọn role hoặc tự liên kết customer_id. Không đưa service_role key vào frontend.

## Quy tắc báo cáo
- Doanh thu gắn với `orders.branch_id` / `payments.branch_id`, không dựa trên chi nhánh chính của nhân viên.
- Báo cáo thu tiền nên tổng hợp payments trạng thái `completed`; hoàn tiền/voided được tách riêng, không cộng vào doanh thu thuần.
- Doanh thu theo đơn và dòng tiền thực thu là hai chỉ số khác nhau; dashboard cần hiển thị rõ định nghĩa.
- Chi phí gắn `expenses.branch_id`; lợi nhuận vận hành sơ bộ = thực thu - hoàn tiền - chi phí ghi nhận.
- Đơn hủy không tính doanh thu; đơn đã giao chưa thanh toán đủ vẫn cần hiển thị công nợ.

## Các điểm phải hoàn thiện trước production
- Chuẩn hóa số điện thoại Việt Nam và quy trình xử lý khách trùng.
- Tạo RPC/server-side workflow để tạo đơn + order_items + payment trong một transaction, kiểm tra giá hiệu lực của đúng chi nhánh và tính tổng tiền ở server. Không tin giá/tổng tiền do browser gửi lên.
- Hoàn thiện quản lý trạng thái đơn, cập nhật customer account liên kết sau xác minh OTP hoặc quy trình xác thực nội bộ.
- Bổ sung kiểm thử RLS cho owner, manager, staff ở chi nhánh khác, nhân viên có assignment hết hạn và customer A/B.
- Thêm audit trigger cho thay đổi quan trọng; kiểm tra không cho sửa/xóa lịch sử thanh toán tùy tiện.
- Xây dashboard doanh thu hợp nhất và drill-down theo chi nhánh; thống nhất quy tắc ngày giờ/múi giờ Asia/Ho_Chi_Minh.
- Thiết lập backup, khôi phục thử, giám sát lỗi và chính sách lưu trữ dữ liệu.

