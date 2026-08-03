-- Drop the catalogue-name uniqueness index. `name` is raw source provenance,
-- not a canonical identity — several catalogue parts carry a `name` that
-- differs from their `id` (Japanese names, parenthetical qualifiers, one wrong
-- value). Uniqueness for catalogue rows is guaranteed by the `id` primary key.
-- Keep the custom-parts index (owner_id, part_class, name) WHERE owner_id IS
-- NOT NULL, since custom names come from the user.
DROP INDEX IF EXISTS parts_catalogue_name_unique;
