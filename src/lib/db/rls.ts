export function tenantIsolationSql(tableName: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(tableName)) {
    throw new Error("Invalid table name for RLS policy");
  }

  return [
    `ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE "${tableName}" FORCE ROW LEVEL SECURITY;`,
    `DROP POLICY IF EXISTS "${tableName}_isolation" ON "${tableName}";`,
    `CREATE POLICY "${tableName}_isolation" ON "${tableName}" FOR ALL TO PUBLIC USING (organization_id = current_setting('app.organization_id')::uuid) WITH CHECK (organization_id = current_setting('app.organization_id')::uuid);`,
  ].join("\n");
}
