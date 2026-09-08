export const TENANT_RLS_TABLES = [
  "document_families",
  "document_types",
  "document_type_versions",
  "instances",
  "assets",
  "notifications",
  "ingest_jobs",
] as const;

export function tenantIsolationSql(tableName: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(tableName)) {
    throw new Error("Invalid table name for RLS policy");
  }

  return [
    `ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE "${tableName}" FORCE ROW LEVEL SECURITY;`,
    `DROP POLICY IF EXISTS "${tableName}_isolation" ON "${tableName}";`,
    `CREATE POLICY "${tableName}_isolation" ON "${tableName}" FOR ALL TO PUBLIC USING (organization_id = app_current_organization_id()) WITH CHECK (organization_id = app_current_organization_id());`,
  ].join("\n");
}
