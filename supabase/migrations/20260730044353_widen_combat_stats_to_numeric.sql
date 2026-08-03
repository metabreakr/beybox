-- Widen the five combat stat columns from integer to numeric(4,1) so they hold
-- half-point ratings (e.g. 5-70 ratchet has def=8.5, sta=9.5). Existing integer
-- values cast to numeric exactly — no data loss. Leave hgt_stat (0–100 rating)
-- and sides (blade count) as integer: no decimals exist for either in the data.
ALTER TABLE parts
  ALTER COLUMN atk TYPE numeric(4,1) USING atk::numeric(4,1),
  ALTER COLUMN def TYPE numeric(4,1) USING def::numeric(4,1),
  ALTER COLUMN sta TYPE numeric(4,1) USING sta::numeric(4,1),
  ALTER COLUMN dsh TYPE numeric(4,1) USING dsh::numeric(4,1),
  ALTER COLUMN brs TYPE numeric(4,1) USING brs::numeric(4,1);
