CREATE OR REPLACE FUNCTION app_current_organization_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  value text;
BEGIN
  value := current_setting('app.organization_id', true);
  IF value IS NULL OR btrim(value) = '' THEN
    RAISE EXCEPTION 'app.organization_id is required'
      USING ERRCODE = '22023';
  END IF;
  RETURN value::uuid;
END;
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_current_organization_id() TO PUBLIC;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_records_isolation" ON "tenant_records";
--> statement-breakpoint
CREATE POLICY "tenant_records_isolation" ON "tenant_records" FOR ALL TO PUBLIC USING (organization_id = app_current_organization_id()) WITH CHECK (organization_id = app_current_organization_id());
--> statement-breakpoint
DROP POLICY IF EXISTS "document_families_isolation" ON "document_families";
--> statement-breakpoint
CREATE POLICY "document_families_isolation" ON "document_families" FOR ALL TO PUBLIC USING (organization_id = app_current_organization_id()) WITH CHECK (organization_id = app_current_organization_id());
--> statement-breakpoint
DROP POLICY IF EXISTS "document_types_isolation" ON "document_types";
--> statement-breakpoint
CREATE POLICY "document_types_isolation" ON "document_types" FOR ALL TO PUBLIC USING (organization_id = app_current_organization_id()) WITH CHECK (organization_id = app_current_organization_id());
--> statement-breakpoint
DROP POLICY IF EXISTS "document_type_versions_isolation" ON "document_type_versions";
--> statement-breakpoint
CREATE POLICY "document_type_versions_isolation" ON "document_type_versions" FOR ALL TO PUBLIC USING (organization_id = app_current_organization_id()) WITH CHECK (organization_id = app_current_organization_id());
--> statement-breakpoint
DROP POLICY IF EXISTS "instances_isolation" ON "instances";
--> statement-breakpoint
CREATE POLICY "instances_isolation" ON "instances" FOR ALL TO PUBLIC USING (organization_id = app_current_organization_id()) WITH CHECK (organization_id = app_current_organization_id());
--> statement-breakpoint
DROP POLICY IF EXISTS "assets_isolation" ON "assets";
--> statement-breakpoint
CREATE POLICY "assets_isolation" ON "assets" FOR ALL TO PUBLIC USING (organization_id = app_current_organization_id()) WITH CHECK (organization_id = app_current_organization_id());
--> statement-breakpoint
DROP POLICY IF EXISTS "notifications_isolation" ON "notifications";
--> statement-breakpoint
CREATE POLICY "notifications_isolation" ON "notifications" FOR ALL TO PUBLIC USING (organization_id = app_current_organization_id()) WITH CHECK (organization_id = app_current_organization_id());
--> statement-breakpoint
DROP POLICY IF EXISTS "ingest_jobs_isolation" ON "ingest_jobs";
--> statement-breakpoint
CREATE POLICY "ingest_jobs_isolation" ON "ingest_jobs" FOR ALL TO PUBLIC USING (organization_id = app_current_organization_id()) WITH CHECK (organization_id = app_current_organization_id());
