-- Drop the products code uniqueness index. `code` is a retail SKU, not an
-- identity — the same code legitimately maps to multiple products that differ
-- only in colourway (e.g. BXG-39 covers both the DMM lottery A-prize and the
-- Metal Coat: Violet variant of the same combo). Product identity is on the
-- `id` primary key, which remains unique. Null codes are still tolerated by
-- virtue of there being no index to constrain them.
DROP INDEX IF EXISTS products_code_unique;
