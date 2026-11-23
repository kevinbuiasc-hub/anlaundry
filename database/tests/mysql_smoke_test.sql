-- Run after schema.sql and seed_data.sql in an empty test database.
SET time_zone = '+07:00';

DELIMITER $$
DROP PROCEDURE IF EXISTS assert_true $$
CREATE PROCEDURE assert_true(IN p_ok BOOLEAN, IN p_message VARCHAR(255))
BEGIN
  IF p_ok IS NULL OR p_ok = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = p_message;
  END IF;
END $$

DROP PROCEDURE IF EXISTS assert_cross_branch_price_rejected $$
CREATE PROCEDURE assert_cross_branch_price_rejected(
  IN p_order_id BIGINT UNSIGNED,
  IN p_other_branch_price_id BIGINT UNSIGNED
)
BEGIN
  DECLARE v_rejected BOOLEAN DEFAULT FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_rejected = TRUE;
    INSERT INTO order_items (
      order_id, branch_id, line_number, service_id, price_option_id,
      branch_service_price_id, service_name_snapshot, option_name_snapshot,
      billing_unit, weight_kg, unit_price_snapshot, price_source
    ) VALUES (
      p_order_id, 1, 2, 1, 1,
      p_other_branch_price_id, 'Giặt + sấy + gấp', 'Mặc định',
      'KG', 1, 18000, 'BRANCH_PRICE'
    );
  END;
  CALL assert_true(v_rejected, 'Cross-branch branch_service_price_id was accepted');
END $$

DROP PROCEDURE IF EXISTS assert_wrong_billing_unit_rejected $$
CREATE PROCEDURE assert_wrong_billing_unit_rejected(IN p_order_id BIGINT UNSIGNED)
BEGIN
  DECLARE v_rejected BOOLEAN DEFAULT FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_rejected = TRUE;
    INSERT INTO order_items (
      order_id, branch_id, line_number, service_id, price_option_id,
      service_name_snapshot, option_name_snapshot,
      billing_unit, item_quantity, unit_price_snapshot,
      price_source, price_override_reason, price_set_by
    ) VALUES (
      p_order_id, 1, 3, 1, 1,
      'Giặt + sấy + gấp', 'Mặc định',
      'ITEM', 1, 17000,
      'CUSTOM_QUOTE', 'Test sai billing unit', 1
    );
  END;
  CALL assert_true(v_rejected, 'Mismatched billing unit was accepted');
END $$

DROP PROCEDURE IF EXISTS assert_second_open_price_rejected $$
CREATE PROCEDURE assert_second_open_price_rejected(IN p_owner_id BIGINT UNSIGNED)
BEGIN
  DECLARE v_rejected BOOLEAN DEFAULT FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_rejected = TRUE;
    INSERT INTO branch_service_prices (
      branch_id, price_option_id, unit_price, minimum_unit_price,
      quote_required, valid_from, created_by, change_note
    ) VALUES (
      1, 1, 17500, NULL, 0, '2026-12-01 00:00:00', p_owner_id, 'Expected rejection in test'
    );
  END;
  CALL assert_true(v_rejected, 'Second open price row was accepted');
END $$
DELIMITER ;

INSERT INTO users (role_id, full_name, email, password_hash)
VALUES (1, 'Test Owner', 'owner-test@example.invalid', 'TEST_ONLY_NOT_A_REAL_PASSWORD_HASH');
SET @owner_id = LAST_INSERT_ID();

INSERT INTO branch_service_prices (
  branch_id, price_option_id, unit_price, minimum_unit_price,
  quote_required, valid_from, created_by, change_note
) VALUES
(1, 1, 17000, NULL, 0, '2026-11-01 00:00:00', @owner_id, 'Test price Hiệp Bình'),
(2, 1, 18000, NULL, 0, '2026-11-01 00:00:00', @owner_id, 'Test price Hòa Hưng');

INSERT INTO customers (customer_code, full_name, phone)
VALUES ('TEST-CUST-001', 'Test Customer', '0900000000');
SET @customer_id = LAST_INSERT_ID();

INSERT INTO orders (
  order_code, branch_id, customer_id, received_at, returned_at,
  order_status, payment_status, payment_method_id, paid_at,
  subtotal_amount, surcharge_amount, discount_amount, total_amount
) VALUES (
  'TEST-ORDER-001', 1, @customer_id, '2026-11-20 09:00:00', '2026-11-20 16:00:00',
  'RETURNED', 'PAID', 1, '2026-11-20 16:00:00',
  34000, 0, 0, 34000
);
SET @order_id = LAST_INSERT_ID();

SELECT id INTO @branch_1_price_id
FROM branch_service_prices
WHERE branch_id = 1 AND price_option_id = 1 AND valid_to IS NULL
LIMIT 1;

SELECT id INTO @branch_2_price_id
FROM branch_service_prices
WHERE branch_id = 2 AND price_option_id = 1 AND valid_to IS NULL
LIMIT 1;

INSERT INTO order_items (
  order_id, branch_id, line_number, service_id, price_option_id,
  branch_service_price_id, service_name_snapshot, option_name_snapshot,
  billing_unit, weight_kg, item_quantity, unit_price_snapshot,
  minimum_unit_price_snapshot, price_source
) VALUES (
  @order_id, 1, 1, 1, 1, @branch_1_price_id,
  'Giặt + sấy + gấp', 'Mặc định',
  'KG', 2, NULL, 17000, NULL, 'BRANCH_PRICE'
);

CALL assert_true(
  (SELECT unit_price = 17000 FROM branch_service_prices WHERE id = @branch_1_price_id),
  'Branch 1 price not stored as expected'
);
CALL assert_true(
  (SELECT unit_price = 18000 FROM branch_service_prices WHERE id = @branch_2_price_id),
  'Branch 2 price not stored independently'
);
CALL assert_true(
  (SELECT subtotal_matches_items = 1 FROM v_order_totals WHERE order_id = @order_id),
  'Order subtotal does not reconcile to item lines'
);
CALL assert_true(
  (SELECT paid_spend = 34000 AND returned_order_count = 1 AND total_weight_kg = 2
   FROM v_customer_summary WHERE customer_id = @customer_id),
  'Customer summary does not match workbook formula logic'
);

CALL assert_cross_branch_price_rejected(@order_id, @branch_2_price_id);
CALL assert_wrong_billing_unit_rejected(@order_id);
CALL assert_second_open_price_rejected(@owner_id);

SELECT 'MYSQL_CRM_SMOKE_TEST_PASSED' AS result;

DROP PROCEDURE IF EXISTS assert_true;
DROP PROCEDURE IF EXISTS assert_cross_branch_price_rejected;
DROP PROCEDURE IF EXISTS assert_wrong_billing_unit_rejected;
DROP PROCEDURE IF EXISTS assert_second_open_price_rejected;
