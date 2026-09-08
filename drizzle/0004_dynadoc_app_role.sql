-- Runtime queries must not use a superuser. FORCE RLS still bypasses for
-- POSTGRES_USER (dynadoc). The app connects as dynadoc_app instead.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dynadoc_app') THEN
    CREATE ROLE dynadoc_app LOGIN PASSWORD 'dynadoc' NOSUPERUSER INHERIT
      NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  ELSE
    ALTER ROLE dynadoc_app WITH NOSUPERUSER NOBYPASSRLS LOGIN;
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO dynadoc_app',
    current_database()
  );
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO dynadoc_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dynadoc_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dynadoc_app;
--> statement-breakpoint
DO $$
DECLARE
  type_name text;
BEGIN
  FOR type_name IN
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'
  LOOP
    EXECUTE format('GRANT USAGE ON TYPE %I TO dynadoc_app', type_name);
  END LOOP;
END
$$;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dynadoc_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO dynadoc_app;
