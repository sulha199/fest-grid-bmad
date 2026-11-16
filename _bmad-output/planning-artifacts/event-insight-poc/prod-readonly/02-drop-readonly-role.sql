-- 02-drop-readonly-role.sql — remove the read-only role and every grant it holds. Run as the database owner when the check is finished.
DROP OWNED BY festgrid_poc_ro;
DROP ROLE IF EXISTS festgrid_poc_ro;
