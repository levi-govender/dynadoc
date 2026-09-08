-- Runs only on an empty data volume. Migration 0004 also creates this role.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dynadoc_app') THEN
    CREATE ROLE dynadoc_app LOGIN PASSWORD 'dynadoc' NOSUPERUSER INHERIT
      NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE dynadoc TO dynadoc_app;
GRANT USAGE ON SCHEMA public TO dynadoc_app;
