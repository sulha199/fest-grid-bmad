-- BUG-068 jsonb migration, step 3 of 3: ROLLBACK (only if needed).
--   psql "$DATABASE_URL" -f 03-rollback.sql
-- Puts back the JSON-string form, and only for values still exactly as 02-apply.sql left them (a value the application has rewritten since is left alone).
-- Reads through Drizzle work in both shapes, so a rollback is only needed if something SQL-side misbehaves.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE c record; m bigint; total bigint := 0;
BEGIN
  FOR c IN SELECT DISTINCT tbl, col FROM _bak_bug068 ORDER BY tbl, col LOOP
    EXECUTE format($q$UPDATE %I t SET %I = b.old_value FROM _bak_bug068 b
                      WHERE b.tbl = %L AND b.col = %L AND b.id = t.id AND t.%I = (b.old_value #>> '{}')::jsonb$q$,
                   c.tbl, c.col, c.tbl, c.col, c.col);
    GET DIAGNOSTICS m = ROW_COUNT;
    RAISE NOTICE '%.%: % restored', c.tbl, c.col, m;
    total := total + m;
  END LOOP;
  RAISE NOTICE 'TOTAL restored: %', total;
END $$;
COMMIT;
