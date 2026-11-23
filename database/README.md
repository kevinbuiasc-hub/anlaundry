# AN Laundry CRM database

## Source of truth
Based only on the latest uploaded workbook **CRM Giặt ủi AN.xlsm**. Earlier CRM files are excluded.

The workbook has 8 sheets: Tong quan, Bao cao kinh doanh, Khach hang, Don giat, Thu chi, Dau tu ban dau, Cau hinh, Hoa don.

## Branch-specific pricing
Every active branch has its own price per service/size option. Only the OWNER role may create, schedule, or change prices; this permission must be enforced by the server/backend, not just by hiding UI controls.

- Global service and size catalogue: \`services\`, \`service_price_options\`.
- Branch-specific price history: \`branch_service_prices\`.
- One open-ended row per branch/option is enforced by a UNIQUE index on a stored generated column. Closed rows generate NULL, and MySQL UNIQUE indexes permit multiple NULL values.
- \`minimum_unit_price\` stores the branch-specific floor for applicable per-item services (the workbook's teddy bear and blanket minimums).
- Quote-only options use \`quote_required=1\` and \`unit_price=NULL\`.
- On order acceptance, the backend reads the price for the order's branch and saves \`unit_price_snapshot\` and \`minimum_unit_price_snapshot\` to \`order_items\`.
- Composite FKs prevent using another branch's price, another service's option, or a KG/ITEM unit that does not match the selected option.
- Historical price rows referenced by orders cannot be deleted.

When changing a price:
1. Begin transaction.
2. Lock the branch/option's price rows with \`SELECT ... FOR UPDATE\`.
3. Reject any overlapping \`valid_from\` / \`valid_to\` period.
4. Close the old row at the new \`valid_from\`.
5. Insert a new row with the price, floor, quote flag, \`created_by\` and change note.
6. Add an audit log and commit.

MySQL does not provide a native exclusion constraint for time-range overlaps; the backend transaction must enforce that check. The unique open-row key prevents two open-ended rows.

## Branch seed
- AnLaundry Hiệp Bình — 18A Đường số 16, Khu phố 4, Hiệp Bình, TP. Hồ Chí Minh.
- AnLaundry Hòa Hưng — 463B/84 Cách Mạng Tháng 8, Hòa Hưng, TP. Hồ Chí Minh.

The seed deliberately contains no branch prices, users, customer records or example orders. The workbook has only one price configuration, so it is not copied to both branches.

## Workbook mapping
| Workbook sheet | Database |
|---|---|
| Tong quan | API/dashboard aggregates |
| Bao cao kinh doanh | Monthly queries by branch, return date, paid date and cash transaction date |
| Khach hang | \`customers\`, \`v_customer_summary\`, \`customer_segments\` |
| Don giat | \`orders\`, \`order_items\`, services and branch price snapshots |
| Thu chi | \`cash_transactions\`, \`cash_transaction_categories\` |
| Dau tu ban dau | \`initial_investments\`; NULL branch means company-wide |
| Cau hinh | \`company_settings\`, \`branch_settings\`, \`branch_service_prices\`, \`customer_segments\` |
| Hoa don | \`invoices\` plus order, customer and branch data; internal receipt only |

## Rules retained
- Clothes are billed by kg; teddy bears and blankets are billed by item and size/type.
- Order-level surcharge and manual promotion amount/reason are stored separately.
- Workflow values: PENDING, PROCESSING, RETURNED, CANCELLED.
- Payment values: UNPAID and PAID; payment method is separate.
- Seeded methods are exactly the workbook's Tiền mặt and Chuyển khoản.
- Customer order count and kg count RETURNED orders; paid spend counts only RETURNED + PAID; promotions are summed for RETURNED orders. This matches the latest workbook's formulas.
- Customer segments use thresholds 1,000,000đ, 3,000,000đ and 5,000,000đ across branches.
- Service revenue is recognized by return date for RETURNED orders.
- Order receipts are recognized by paid date for PAID orders.
- Other income and actual expenses use the transaction date in Thu chi.
- Do not duplicate order payments in the Thu chi ledger.
- Initial investments remain separate from operating expenses; company-wide items may have NULL branch_id.

## cPanel / MySQL
Target: MySQL **8.0.16+**, InnoDB, utf8mb4.
1. Create a fresh database and database user in cPanel; grant privileges to that database.
2. Select the empty database in phpMyAdmin.
3. Import \`schema.sql\`.
4. Import \`seed_data.sql\` once.
5. Create the first OWNER account via a secure server-side bootstrap. Never commit credentials or production password hashes.
6. As OWNER, configure each branch's rate list and item minimums before accepting billable orders.
7. Configure the branch-specific reference budgets and company invoice settings.

This schema is for a fresh install. \`CREATE TABLE IF NOT EXISTS\` does not migrate an existing structure. Use versioned migration files for future changes.

## Backend controls
- Use parameterized queries and credentials outside the public web root/GitHub.
- Enforce OWNER-only pricing management server-side and restrict staff to \`user_branch_access\`.
- Create order header + lines + amounts inside one transaction.
- Calculate \`subtotal_amount\` from \`order_items.line_subtotal\`; \`v_order_totals\` supports reconciliation.
- Lock and validate price history when publishing a change.
- Preserve financial history and referenced branch price records.
- Audit price, discount, total, payment, role/access and cash changes.

## Validation
The workflow \`.github/workflows/database-mysql-validation.yml\` imports schema + seed and runs \`database/tests/mysql_smoke_test.sql\` against MySQL 8.0.16 and 8.0.36. Only report runtime validation as passed when both workflow jobs succeed.

This audit revision remains on \`crm-database-preview\`; it is not deployed to cPanel or merged into \`main\`.
