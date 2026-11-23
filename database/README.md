# AN Laundry CRM database

## Source of truth

This database draft is based on the latest workbook supplied in this project:
**CRM Giặt ủi AN.xlsm**. Earlier CRM workbook versions are intentionally excluded.

The workbook has eight sheets:

1. Tong quan — dashboard derived from operating data.
2. Bao cao kinh doanh — monthly operating report.
3. Khach hang — customer master and derived customer metrics.
4. Don giat — orders, service quantities, prices, surcharge, promotion, payment and status.
5. Thu chi — other income and actual expenses.
6. Dau tu ban dau — initial investment and working capital.
7. Cau hinh — service prices, item/size rates, budget references and customer spend tiers.
8. Hoa don — internal payment receipt/PDF lookup.

## Important multi-branch pricing rule

Prices are **not global**. Each branch has its own active price for each service/size option. The business owner is the role that may create and publish branch price changes. Branch managers and staff can read the prices assigned to their branch but must not change them.

- The global service catalog is stored in \`services\` and \`service_price_options\`.
- Actual rates are stored in \`branch_service_prices\`, keyed by branch and price option.
- Price changes are versioned: close the previous row with \`valid_to\`, then insert a new row with a new \`valid_from\`. Do not overwrite an old unit price.
- Every order item stores \`unit_price_snapshot\`, the amount applied at the time the order was accepted. Later price changes must not alter old orders or receipts.
- The backend must authorize price create/update actions to the OWNER role. Do not rely on hiding controls in the browser alone.
- A branch should not accept a billable order line until the required branch price is configured, except where the service is explicitly a custom quote.

The workbook's Cau hinh sheet contains one set of prices, not a price list per branch. Therefore this seed intentionally does **not** assign those values to both branches. The owner must confirm which branch those workbook values belong to, then enter each branch's rates separately. This avoids silently copying one branch's prices to another.

## Branches included

The seed file includes the two AnLaundry branches already configured in the website project:

- AnLaundry Hiệp Bình
- AnLaundry Hòa Hưng

No CRM customer/order data or user password is seeded.

## Core workbook-to-database mapping

| Workbook sheet | Database |
|---|---|
| Tong quan | dashboard queries / API aggregation |
| Bao cao kinh doanh | monthly queries filtered by branch or all branches |
| Khach hang | \`customers\`, \`v_customer_summary\`, \`customer_segments\` |
| Don giat | \`orders\`, \`order_items\`, \`services\`, branch price snapshot |
| Thu chi | \`cash_transactions\`, \`cash_transaction_categories\` |
| Dau tu ban dau | \`initial_investments\`, \`branch_settings.working_capital_reserve\` |
| Cau hinh | \`branch_service_prices\`, \`branch_settings\`, \`customer_segments\` |
| Hoa don | \`invoices\` and order data |

## Business rules retained

- Clothing services are billed by kilogram.
- Teddy bear and blanket services are billed by item and the workbook's size/type options are represented in \`service_price_options\`.
- The workbook supports additional surcharge and a manual promotion amount with a reason.
- Order payment status is separate from order processing status.
- Workbook order statuses: Chờ xử lý, Đang xử lý, Đã trả, Đã hủy.
- Payment statuses: Chưa thanh toán, Đã thanh toán.
- Order payment methods in the workbook: Tiền mặt and Chuyển khoản. The broader methods from Thu chi are also represented.
- Do not record order payment a second time in the Thu chi ledger.
- Service revenue is reported by the return/delivery date of returned orders.
- Cash received from orders is reported by paid date.
- Other income and actual expenses are reported by the transaction date in Thu chi.
- Initial investment is tracked separately from monthly operating expenses.
- Customer segments are based on lifetime paid spend, with workbook thresholds: 1,000,000đ; 3,000,000đ; and 5,000,000đ.
- No loyalty-points ledger is included because the latest workbook does not use points.

## cPanel / MySQL deployment

Target: MySQL **8.0.16+**, InnoDB, utf8mb4.

1. In cPanel, create the MySQL database and a database user. Grant that user the required privileges on this database.
2. Open phpMyAdmin and select the newly created database.
3. Import \`schema.sql\` first.
4. Import \`seed_data.sql\` second.
5. Create the first OWNER user through a secure backend setup process. Never store a plaintext password in SQL or commit credentials to GitHub.
6. Sign in as the owner and configure a separate price list for every active branch before allowing staff to create billable orders.
7. Configure branch-specific monthly reference budgets and receipt note as required.

Do not commit real customer records, password hashes, database credentials, API keys, or production exports to this repository.

## Backend responsibilities

- Use prepared statements / parameterized queries.
- Keep DB credentials in hosting environment configuration outside the public web root and outside GitHub.
- Enforce role-based access on the server: OWNER can manage all branches and price lists; branch users are limited to assigned branches.
- When accepting an order, load the current price for that order's branch and price option, then save the price snapshot in order_items.
- Calculate order subtotal, surcharge, promotion and total within a database transaction.
- When a price changes, close the active price row and insert a new row in one transaction.
- Restrict order update/delete after cancellation/return according to business policy; retain an audit trail for financial and price changes.

## Draft status

This is a reviewable initial schema package on branch \`crm-database-preview\`. It is not yet imported into the live cPanel database and is not merged into \`main\`.
