-- Reference data for AN Laundry CRM.
-- Run ONCE after schema.sql on a new/empty database.
-- No customer/order samples, user accounts or branch prices are seeded.

INSERT INTO roles (id, role_code, role_name, description) VALUES
(1, 'OWNER', 'Chủ doanh nghiệp', 'Toàn quyền quản lý hệ thống, chi nhánh và bảng giá'),
(2, 'BRANCH_MANAGER', 'Quản lý chi nhánh', 'Quản lý nghiệp vụ tại chi nhánh được phân quyền'),
(3, 'STAFF', 'Nhân viên', 'Tiếp nhận và xử lý đơn tại chi nhánh được phân quyền');

INSERT INTO company_settings (id, business_name, invoice_note)
VALUES (1, 'AnLaundry', 'Cảm ơn Quý khách đã sử dụng dịch vụ!');

INSERT INTO branches
  (id, branch_code, branch_name, street_address, ward, city, country_code, is_active)
VALUES
(1, 'HIEP_BINH', 'AnLaundry Hiệp Bình', '18A Đường số 16, Khu phố 4', 'Hiệp Bình', 'TP. Hồ Chí Minh', 'VN', 1),
(2, 'HOA_HUNG', 'AnLaundry Hòa Hưng', '463B/84 Cách Mạng Tháng 8', 'Hòa Hưng', 'TP. Hồ Chí Minh', 'VN', 1);

INSERT INTO services (id, service_code, service_name, sort_order, is_active) VALUES
(1, 'WASH_DRY_FOLD', 'Giặt + sấy + gấp', 1, 1),
(2, 'WASH_LINE_DRY', 'Giặt + phơi', 2, 1),
(3, 'QUICK_WASH', 'Giặt nhanh', 3, 1),
(4, 'TEDDY_BEAR', 'Giặt gấu bông', 4, 1),
(5, 'BLANKET', 'Giặt chăn/mền', 5, 1),
(6, 'OTHER', 'Khác', 6, 1);

INSERT INTO service_price_options
  (id, service_id, option_code, option_name, billing_unit, default_quote_required, sort_order, is_active)
VALUES
(1, 1, 'PER_KG', 'Mặc định', 'KG', 0, 1, 1),
(2, 2, 'PER_KG', 'Mặc định', 'KG', 0, 1, 1),
(3, 3, 'PER_KG', 'Mặc định', 'KG', 0, 1, 1),
(4, 4, 'UNDER_20CM', 'Dưới 20cm', 'ITEM', 0, 1, 1),
(5, 4, '20_50CM', '20–50cm', 'ITEM', 0, 2, 1),
(6, 4, '51_80CM', '51–80cm', 'ITEM', 0, 3, 1),
(7, 4, '81_100CM', '81–100cm', 'ITEM', 0, 4, 1),
(8, 4, '101_150CM', '101–150cm', 'ITEM', 0, 5, 1),
(9, 4, 'OVER_150CM', 'Trên 150cm', 'ITEM', 0, 6, 1),
(10, 5, 'THIN_SINGLE', 'Chăn mỏng đơn', 'ITEM', 0, 1, 1),
(11, 5, 'THIN_DOUBLE', 'Chăn mỏng đôi', 'ITEM', 0, 2, 1),
(12, 5, 'COTTON_SINGLE', 'Mền bông đơn', 'ITEM', 0, 3, 1),
(13, 5, 'COTTON_DOUBLE', 'Mền bông đôi', 'ITEM', 0, 4, 1),
(14, 5, 'THICK_LARGE', 'Mền dày cỡ lớn', 'ITEM', 0, 5, 1),
(15, 5, 'DOWN_FEATHER_QUOTE', 'Chăn lông/lông vũ – báo giá', 'ITEM', 1, 6, 1),
(16, 5, 'TOPPER_OVERSIZE_QUOTE', 'Topper/quá khổ – báo giá', 'ITEM', 1, 7, 1),
(17, 6, 'OTHER_QUOTE_KG', 'Khác – báo giá theo kg', 'KG', 1, 1, 1),
(18, 6, 'OTHER_QUOTE_ITEM', 'Khác – báo giá theo món', 'ITEM', 1, 2, 1);

INSERT INTO customer_segments
  (id, segment_code, segment_name, min_paid_spend, sort_order, is_active)
VALUES
(1, 'REGULAR', 'Khách thường', 0, 1, 1),
(2, 'LOYAL', 'Thân thiết', 1000000, 2, 1),
(3, 'VIP', 'VIP', 3000000, 3, 1),
(4, 'VIP_PRIORITY', 'VIP ưu tiên', 5000000, 4, 1);

INSERT INTO payment_methods (id, method_code, method_name, is_active, sort_order) VALUES
(1, 'CASH', 'Tiền mặt', 1, 1),
(2, 'BANK_TRANSFER', 'Chuyển khoản', 1, 2);

INSERT INTO cash_transaction_categories
  (id, category_code, category_name, flow_direction, sort_order, is_active)
VALUES
(1, 'OTHER_INCOME', 'Thu khác', 'INCOME', 1, 1),
(2, 'RENT', 'Thuê mặt bằng', 'EXPENSE', 10, 1),
(3, 'ELECTRICITY', 'Điện', 'EXPENSE', 11, 1),
(4, 'WATER', 'Nước', 'EXPENSE', 12, 1),
(5, 'DETERGENT', 'Hóa chất / nước giặt', 'EXPENSE', 13, 1),
(6, 'PACKAGING', 'Bao bì / vật tư', 'EXPENSE', 14, 1),
(7, 'LABOR', 'Nhân công', 'EXPENSE', 15, 1),
(8, 'MARKETING', 'Marketing', 'EXPENSE', 16, 1),
(9, 'MAINTENANCE', 'Sửa chữa / bảo trì', 'EXPENSE', 17, 1),
(10, 'TRANSPORT', 'Vận chuyển', 'EXPENSE', 18, 1),
(11, 'BANK_FEE', 'Phí ngân hàng', 'EXPENSE', 19, 1),
(12, 'OTHER_EXPENSE', 'Chi khác', 'EXPENSE', 20, 1);

INSERT INTO branch_settings (branch_id) VALUES (1), (2);

-- Deliberately no rows in branch_service_prices.
-- OWNER enters each branch's prices and applicable minimum item-price floors independently.
