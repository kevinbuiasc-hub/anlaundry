# SQL audit report — AN Laundry CRM

Reviewed against the latest uploaded workbook **CRM Giặt ủi AN.xlsm** and the confirmed rule that each branch has an owner-managed price list.

## Issues found and corrected

1. **CHECK / FK referential-action conflict.** The earlier item price-source CHECK examined \`branch_service_price_id\` while that FK used \`ON DELETE SET NULL\`. MySQL prohibits CHECK constraints on columns participating in FK referential actions. The order-item FKs used by CHECKs now omit referential-action clauses (default RESTRICT), and historical price rows cannot be deleted.
2. **Cross-branch price assignment.** The old schema could attach a price from branch B to an order from branch A. Composite FKs now bind the line's branch to its order and its branch price.
3. **Service / option mismatch.** A line could combine one service with another service's option. A composite FK now ties the service, price option and billing unit together.
4. **Wrong billing unit.** A KG price option could previously be stored as ITEM. The billing unit is part of the composite FK and must match the option catalogue.
5. **Multiple default branches.** A generated nullable key with UNIQUE constraint allows at most one default branch per user.
6. **Missing per-branch floor price.** Added branch-specific \`minimum_unit_price\` and line-level \`minimum_unit_price_snapshot\` for the workbook's teddy bear/blanket minimum rates.
7. **Financial and status checks.** Added branch budget nonnegative checks, discount reason requirement, and strict returned_at/status consistency.
8. **Initial investment scope.** Shared/company-wide investment rows can use \`branch_id=NULL\`; branch-specific rows retain a branch.
9. **Seed conflict visibility.** Removed \`INSERT IGNORE\`; conflicts now fail visibly instead of being silently skipped.
10. **Workbook customer formulas.** Customer count and kg count returned orders; paid spend counts returned + paid orders; promotion totals/counts use returned orders. This matches the latest workbook formulas.

## MySQL compatibility

- Uses InnoDB, utf8mb4, JSON, generated stored columns, composite foreign keys and enforced CHECK constraints.
- CHECK constraints are enforced by MySQL starting at 8.0.16; earlier versions parse but ignore them.
- Generated-column UNIQUE indexes are used for one open price per branch/option and one default branch per user. MySQL permits multiple NULL values in a UNIQUE index, which is intentional for closed price history / non-default access rows.
- Constraint identifiers are kept below 64 characters.
- No local MySQL server or Docker runtime is installed in the review environment. A GitHub Actions matrix now tests DDL, seed imports and key business rules on MySQL 8.0.16 and 8.0.36. Do not call runtime validation passed until those jobs complete successfully.

## Controls still required in the backend

- Enforce OWNER-only price changes on the server. Database roles and branch access alone do not authorize writes.
- On price changes, use a transaction and \`SELECT ... FOR UPDATE\`, and reject overlapping validity periods. MySQL has no native exclusion constraint for arbitrary time ranges.
- Derive order prices from the selected branch's current price; never trust a browser-supplied amount.
- Calculate order subtotal from \`order_items.line_subtotal\` and update order totals in the same transaction. \`v_order_totals\` supports reconciliation.
- Create the first OWNER account through secure server-side bootstrap, not a committed password hash.
- The workbook contains one price configuration, not separate prices by branch. Therefore no price values are copied to both branches. The OWNER must set both branch lists separately.

## Deployment status

This audit revision is on \`crm-database-preview\`. It has not been imported into production cPanel and is not merged into \`main\`.
