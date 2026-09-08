import { eq, sql, type Column } from "drizzle-orm";
import { getDb, type Database } from "@/lib/db";

export class OrganizationContextError extends Error {
  constructor(message = "organization_id is required") {
    super(message);
    this.name = "OrganizationContextError";
  }
}

export function requireOrganizationId(
  organizationId: string | undefined | null,
) {
  if (!organizationId?.trim()) {
    throw new OrganizationContextError();
  }
  return organizationId;
}

export function organizationEq(column: Column, organizationId: string) {
  return eq(column, requireOrganizationId(organizationId));
}

export async function withOrganization<T>(
  organizationId: string | undefined | null,
  callback: (db: Database) => Promise<T>,
) {
  const id = requireOrganizationId(organizationId);
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.organization_id', ${id}, true)`);
    return callback(tx as unknown as Database);
  });
}
