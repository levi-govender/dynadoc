import assert from "node:assert/strict";
import test from "node:test";
import { TENANT_RLS_TABLES, tenantIsolationSql } from "./rls";
import { OrganizationContextError, requireOrganizationId } from "./tenant";

test("requireOrganizationId throws instead of querying without an org", () => {
  assert.throws(() => requireOrganizationId(undefined), OrganizationContextError);
  assert.throws(() => requireOrganizationId(""), OrganizationContextError);
  assert.equal(requireOrganizationId("org-1"), "org-1");
});

test("tenantIsolationSql uses SET LOCAL-compatible current_setting", () => {
  const sql = tenantIsolationSql("tenant_records");
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /organization_id = app_current_organization_id\(\)/);
  for (const tableName of TENANT_RLS_TABLES) {
    assert.match(tenantIsolationSql(tableName), new RegExp(`"${tableName}"`));
  }
});
