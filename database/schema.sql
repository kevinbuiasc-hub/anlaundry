-- AN Laundry CRM — MySQL 8.0.16+
-- Based only on the latest uploaded "CRM Giặt ủi AN.xlsm" and confirmed branch-pricing rule.
-- Select a NEW, EMPTY cPanel database before importing. Run seed_data.sql after this file.

SET NAMES utf8mb4;
SET time_zone = '+07:00';

CREATE TABLE IF NOT EXISTS roles (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_code VARCHAR(40) NOT NULL,
  role_name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_code (role_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS company_settings (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  business_name VARCHAR(150) NOT NULL,
  support_phone VARCHAR(30) NULL,
  support_email VARCHAR(190) NULL,
  invoice_note VARCHAR(500) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_company_settings_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS branches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  branch_code VARCHAR(30) NOT NULL,
  branch_name VARCHAR(150) NOT NULL,
  street_address VARCHAR(255) NULL,
  ward VARCHAR(120) NULL,
  city VARCHAR(120) NULL,
  country_code CHAR(2) NOT NULL DEFAULT 'VN',
  phone VARCHAR(30) NULL,
  email VARCHAR(190) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  opened_at DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_branches_code (branch_code),
  KEY idx_branches_active (is_active, branch_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id SMALLINT UNSIGNED NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(30) NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_active (role_id, is_active),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Generated nullable key + UNIQUE index: only one default branch is allowed per user.
CREATE TABLE IF NOT EXISTS user_branch_access (
  user_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  default_user_id BIGINT UNSIGNED GENERATED ALWAYS AS
    (CASE WHEN is_default = 1 THEN user_id ELSE NULL END) STORED,
  PRIMARY KEY (user_id, branch_id),
  UNIQUE KEY uq_user_one_default_branch (default_user_id),
  KEY idx_user_branch_branch (branch_id, user_id),
  CONSTRAINT fk_uba_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_uba_branch FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_uba_is_default CHECK (is_default IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_code VARCHAR(40) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(190) NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_code (customer_code),
  KEY idx_customers_phone (phone),
  KEY idx_customers_name (full_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS services (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  service_code VARCHAR(40) NOT NULL,
  service_name VARCHAR(120) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_services_code (service_code),
  KEY idx_services_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_price_options (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  service_id SMALLINT UNSIGNED NOT NULL,
  option_code VARCHAR(50) NOT NULL,
  option_name VARCHAR(150) NOT NULL,
  billing_unit ENUM('KG','ITEM') NOT NULL,
  default_quote_required TINYINT(1) NOT NULL DEFAULT 0,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_option_code (service_id, option_code),
  UNIQUE KEY uq_option_service_unit (service_id, id, billing_unit),
  KEY idx_price_options_service (service_id, is_active, sort_order),
  CONSTRAINT fk_price_options_service FOREIGN KEY (service_id) REFERENCES services(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_price_option_quote CHECK (default_quote_required IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Separate, versioned rates by branch + service option. Keep historical rows.
CREATE TABLE IF NOT EXISTS branch_service_prices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  branch_id BIGINT UNSIGNED NOT NULL,
  price_option_id SMALLINT UNSIGNED NOT NULL,
  unit_price DECIMAL(12,2) NULL,
  minimum_unit_price DECIMAL(12,2) NULL,
  quote_required TINYINT(1) NOT NULL DEFAULT 0,
  valid_from DATETIME NOT NULL,
  valid_to DATETIME NULL,
  open_period_key TINYINT GENERATED ALWAYS AS
    (CASE WHEN valid_to IS NULL THEN 1 ELSE NULL END) STORED,
  created_by BIGINT UNSIGNED NOT NULL,
  change_note VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_branch_option_start (branch_id, price_option_id, valid_from),
  UNIQUE KEY uq_branch_option_open (branch_id, price_option_id, open_period_key),
  UNIQUE KEY uq_branch_price_option_ref (branch_id, id, price_option_id),
  KEY idx_branch_prices_current (branch_id, price_option_id, valid_from, valid_to),
  CONSTRAINT fk_bsp_branch FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_bsp_option FOREIGN KEY (price_option_id) REFERENCES service_price_options(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_bsp_user FOREIGN KEY (created_by) REFERENCES users(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_bsp_period CHECK (valid_to IS NULL OR valid_to > valid_from),
  CONSTRAINT chk_bsp_quote CHECK (quote_required IN (0, 1)),
  CONSTRAINT chk_bsp_price CHECK (
    (quote_required = 1 AND unit_price IS NULL AND minimum_unit_price IS NULL)
    OR
    (quote_required = 0
      AND unit_price IS NOT NULL
      AND unit_price > 0
      AND (minimum_unit_price IS NULL
        OR (minimum_unit_price > 0 AND unit_price >= minimum_unit_price)))
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS branch_settings (
  branch_id BIGINT UNSIGNED NOT NULL,
  monthly_rent_reference DECIMAL(14,2) NULL,
  monthly_labor_reference DECIMAL(14,2) NULL,
  monthly_utilities_reference DECIMAL(14,2) NULL,
  monthly_marketing_reference DECIMAL(14,2) NULL,
  operating_days_per_month TINYINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (branch_id),
  CONSTRAINT fk_branch_settings_branch FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_branch_settings_user FOREIGN KEY (updated_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_branch_operating_days CHECK (
    operating_days_per_month IS NULL OR operating_days_per_month BETWEEN 1 AND 31
  ),
  CONSTRAINT chk_branch_budgets CHECK (
    (monthly_rent_reference IS NULL OR monthly_rent_reference >= 0)
    AND (monthly_labor_reference IS NULL OR monthly_labor_reference >= 0)
    AND (monthly_utilities_reference IS NULL OR monthly_utilities_reference >= 0)
    AND (monthly_marketing_reference IS NULL OR monthly_marketing_reference >= 0)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_segments (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  segment_code VARCHAR(40) NOT NULL,
  segment_name VARCHAR(100) NOT NULL,
  min_paid_spend DECIMAL(14,2) NOT NULL DEFAULT 0,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customer_segments_code (segment_code),
  CONSTRAINT chk_customer_segment_spend CHECK (min_paid_spend >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_methods (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  method_code VARCHAR(40) NOT NULL,
  method_name VARCHAR(100) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_methods_code (method_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_code VARCHAR(50) NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NULL,
  received_at DATETIME NOT NULL,
  returned_at DATETIME NULL,
  order_status ENUM('PENDING','PROCESSING','RETURNED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  payment_status ENUM('UNPAID','PAID') NOT NULL DEFAULT 'UNPAID',
  payment_method_id SMALLINT UNSIGNED NULL,
  paid_at DATETIME NULL,
  subtotal_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  surcharge_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount_reason VARCHAR(500) NULL,
  notes TEXT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_code (order_code),
  UNIQUE KEY uq_orders_id_branch (id, branch_id),
  KEY idx_orders_branch_received (branch_id, received_at),
  KEY idx_orders_branch_returned (branch_id, order_status, returned_at),
  KEY idx_orders_branch_paid (branch_id, payment_status, paid_at),
  KEY idx_orders_customer (customer_id, received_at),
  KEY idx_orders_status (order_status, payment_status),
  CONSTRAINT fk_orders_branch FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_orders_payment_method FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_orders_created_by FOREIGN KEY (created_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_orders_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_orders_amounts CHECK (
    subtotal_amount >= 0 AND surcharge_amount >= 0
    AND discount_amount >= 0 AND total_amount >= 0
    AND total_amount = GREATEST(0, subtotal_amount + surcharge_amount - discount_amount)
  ),
  CONSTRAINT chk_orders_paid_at CHECK (
    (payment_status = 'PAID' AND paid_at IS NOT NULL)
    OR (payment_status = 'UNPAID' AND paid_at IS NULL)
  ),
  CONSTRAINT chk_orders_returned_at CHECK (
    (order_status = 'RETURNED' AND returned_at IS NOT NULL)
    OR (order_status <> 'RETURNED' AND returned_at IS NULL)
  ),
  CONSTRAINT chk_orders_discount_reason CHECK (
    discount_amount = 0
    OR (discount_reason IS NOT NULL AND CHAR_LENGTH(TRIM(discount_reason)) > 0)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- branch_id is intentionally duplicated in order_items so composite FKs
-- can ensure the item and its branch-specific price belong to the parent order's branch.
CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  line_number SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  service_id SMALLINT UNSIGNED NOT NULL,
  price_option_id SMALLINT UNSIGNED NOT NULL,
  branch_service_price_id BIGINT UNSIGNED NULL,
  service_name_snapshot VARCHAR(120) NOT NULL,
  option_name_snapshot VARCHAR(150) NOT NULL,
  billing_unit ENUM('KG','ITEM') NOT NULL,
  weight_kg DECIMAL(10,3) NULL,
  item_quantity DECIMAL(10,3) NULL,
  unit_price_snapshot DECIMAL(12,2) NOT NULL,
  minimum_unit_price_snapshot DECIMAL(12,2) NULL,
  price_source ENUM('BRANCH_PRICE','CUSTOM_QUOTE','OWNER_OVERRIDE') NOT NULL DEFAULT 'BRANCH_PRICE',
  price_override_reason VARCHAR(500) NULL,
  price_set_by BIGINT UNSIGNED NULL,
  line_subtotal DECIMAL(14,2) GENERATED ALWAYS AS (
    ROUND(
      CASE
        WHEN billing_unit = 'KG' THEN COALESCE(weight_kg, 0) * unit_price_snapshot
        ELSE COALESCE(item_quantity, 0) * unit_price_snapshot
      END, 2
    )
  ) STORED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_line (order_id, line_number),
  KEY idx_order_items_order_branch (order_id, branch_id),
  KEY idx_order_items_service_option (service_id, price_option_id, billing_unit),
  KEY idx_order_items_branch_price (branch_id, branch_service_price_id, price_option_id),
  KEY idx_order_items_price_set_by (price_set_by),
  CONSTRAINT fk_order_items_order_branch FOREIGN KEY (order_id, branch_id)
    REFERENCES orders(id, branch_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  -- No ON UPDATE/DELETE clause on FKs whose columns participate in CHECK constraints.
  CONSTRAINT fk_order_items_service_option FOREIGN KEY (service_id, price_option_id, billing_unit)
    REFERENCES service_price_options(service_id, id, billing_unit),
  CONSTRAINT fk_order_items_branch_price FOREIGN KEY (branch_id, branch_service_price_id, price_option_id)
    REFERENCES branch_service_prices(branch_id, id, price_option_id),
  CONSTRAINT fk_order_items_price_set_by FOREIGN KEY (price_set_by) REFERENCES users(id),
  CONSTRAINT chk_order_item_quantity CHECK (
    (billing_unit = 'KG' AND weight_kg IS NOT NULL AND weight_kg > 0 AND item_quantity IS NULL)
    OR (billing_unit = 'ITEM' AND item_quantity IS NOT NULL AND item_quantity > 0 AND weight_kg IS NULL)
  ),
  CONSTRAINT chk_order_item_price CHECK (
    unit_price_snapshot > 0
    AND (minimum_unit_price_snapshot IS NULL OR minimum_unit_price_snapshot > 0)
  ),
  CONSTRAINT chk_order_item_price_source CHECK (
    (price_source = 'BRANCH_PRICE'
      AND branch_service_price_id IS NOT NULL
      AND price_override_reason IS NULL
      AND (minimum_unit_price_snapshot IS NULL
        OR unit_price_snapshot >= minimum_unit_price_snapshot))
    OR
    (price_source = 'CUSTOM_QUOTE'
      AND branch_service_price_id IS NULL
      AND price_override_reason IS NOT NULL
      AND CHAR_LENGTH(TRIM(price_override_reason)) > 0
      AND price_set_by IS NOT NULL)
    OR
    (price_source = 'OWNER_OVERRIDE'
      AND price_override_reason IS NOT NULL
      AND CHAR_LENGTH(TRIM(price_override_reason)) > 0
      AND price_set_by IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cash_transaction_categories (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_code VARCHAR(50) NOT NULL,
  category_name VARCHAR(120) NOT NULL,
  flow_direction ENUM('INCOME','EXPENSE') NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cash_categories_code (category_code),
  KEY idx_cash_categories_direction (flow_direction, is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Store only other income and actual expenses here; order payments are not duplicated.
CREATE TABLE IF NOT EXISTS cash_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  branch_id BIGINT UNSIGNED NOT NULL,
  transaction_date DATE NOT NULL,
  category_id SMALLINT UNSIGNED NOT NULL,
  description VARCHAR(500) NULL,
  amount DECIMAL(14,2) NOT NULL,
  payment_method_id SMALLINT UNSIGNED NULL,
  counterparty VARCHAR(190) NULL,
  notes TEXT NULL,
  recorded_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cash_branch_date (branch_id, transaction_date),
  KEY idx_cash_category_date (category_id, transaction_date),
  CONSTRAINT fk_cash_branch FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_cash_category FOREIGN KEY (category_id) REFERENCES cash_transaction_categories(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_cash_payment_method FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_cash_recorded_by FOREIGN KEY (recorded_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_cash_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- NULL branch_id means a company-wide setup / working-capital item.
CREATE TABLE IF NOT EXISTS initial_investments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  branch_id BIGINT UNSIGNED NULL,
  investment_type ENUM('EQUIPMENT','SETUP_COST','WORKING_CAPITAL') NOT NULL DEFAULT 'EQUIPMENT',
  item_name VARCHAR(190) NOT NULL,
  quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(14,2) GENERATED ALWAYS AS (ROUND(quantity * unit_cost, 2)) STORED,
  purchase_status ENUM('PURCHASED','NOT_PURCHASED') NOT NULL DEFAULT 'NOT_PURCHASED',
  purchased_at DATE NULL,
  notes TEXT NULL,
  extra_notes TEXT NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_investments_branch (branch_id, investment_type, purchase_status),
  CONSTRAINT fk_investments_branch FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_investments_user FOREIGN KEY (created_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_investment_amounts CHECK (quantity >= 0 AND unit_cost >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Internal service receipt PDF, not a statutory e-invoice.
CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  invoice_code VARCHAR(50) NOT NULL,
  invoice_type ENUM('INTERNAL_RECEIPT') NOT NULL DEFAULT 'INTERNAL_RECEIPT',
  pdf_url VARCHAR(1000) NULL,
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoice_order (order_id),
  UNIQUE KEY uq_invoice_code (invoice_code),
  CONSTRAINT fk_invoices_order FOREIGN KEY (order_id) REFERENCES orders(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_invoices_user FOREIGN KEY (created_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  branch_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NULL,
  action_code VARCHAR(60) NOT NULL,
  entity_name VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  old_values JSON NULL,
  new_values JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_branch_date (branch_id, created_at),
  KEY idx_audit_entity (entity_name, entity_id, created_at),
  KEY idx_audit_user_date (user_id, created_at),
  CONSTRAINT fk_audit_branch FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE RESTRICT ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer formulas from workbook:
-- order count/weight for returned orders; spend for returned AND paid orders;
-- promotions for returned orders.
CREATE OR REPLACE VIEW v_customer_summary AS
SELECT
  c.id AS customer_id,
  c.customer_code,
  c.full_name,
  c.phone,
  c.created_at,
  COALESCE(a.returned_order_count, 0) AS returned_order_count,
  COALESCE(a.total_weight_kg, 0) AS total_weight_kg,
  COALESCE(a.paid_spend, 0) AS paid_spend,
  COALESCE(a.discounted_order_count, 0) AS discounted_order_count,
  COALESCE(a.total_discount_amount, 0) AS total_discount_amount,
  CASE
    WHEN COALESCE(a.paid_spend, 0) >= (
      SELECT min_paid_spend FROM customer_segments
      WHERE segment_code = 'VIP_PRIORITY' AND is_active = 1 LIMIT 1
    ) THEN 'VIP ưu tiên'
    WHEN COALESCE(a.paid_spend, 0) >= (
      SELECT min_paid_spend FROM customer_segments
      WHERE segment_code = 'VIP' AND is_active = 1 LIMIT 1
    ) THEN 'VIP'
    WHEN COALESCE(a.paid_spend, 0) >= (
      SELECT min_paid_spend FROM customer_segments
      WHERE segment_code = 'LOYAL' AND is_active = 1 LIMIT 1
    ) THEN 'Thân thiết'
    ELSE 'Khách thường'
  END AS customer_segment
FROM customers c
LEFT JOIN (
  SELECT
    o.customer_id,
    COUNT(*) AS returned_order_count,
    SUM(COALESCE(i.total_weight_kg, 0)) AS total_weight_kg,
    SUM(CASE WHEN o.payment_status = 'PAID' THEN o.total_amount ELSE 0 END) AS paid_spend,
    SUM(CASE WHEN o.discount_amount > 0 THEN 1 ELSE 0 END) AS discounted_order_count,
    SUM(o.discount_amount) AS total_discount_amount
  FROM orders o
  LEFT JOIN (
    SELECT order_id, SUM(COALESCE(weight_kg, 0)) AS total_weight_kg
    FROM order_items
    GROUP BY order_id
  ) i ON i.order_id = o.id
  WHERE o.order_status = 'RETURNED'
  GROUP BY o.customer_id
) a ON a.customer_id = c.id;

-- Reconciliation view. Backend writes header totals from order_items inside one transaction.
CREATE OR REPLACE VIEW v_order_totals AS
SELECT
  o.id AS order_id,
  o.order_code,
  o.branch_id,
  o.subtotal_amount AS stored_subtotal_amount,
  COALESCE(SUM(oi.line_subtotal), 0) AS calculated_subtotal_amount,
  o.surcharge_amount,
  o.discount_amount,
  o.total_amount,
  (o.subtotal_amount = COALESCE(SUM(oi.line_subtotal), 0)) AS subtotal_matches_items
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY
  o.id, o.order_code, o.branch_id, o.subtotal_amount,
  o.surcharge_amount, o.discount_amount, o.total_amount;
