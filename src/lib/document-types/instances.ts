import { and, eq, isNull } from "drizzle-orm";
import { documentTypeVersions, documentTypes, instances } from "@/lib/db/schema";
import { organizationEq, withOrganization } from "@/lib/db/tenant";

export class InstanceNotFoundError extends Error {
  constructor(message = "Instance not found") {
    super(message);
    this.name = "InstanceNotFoundError";
  }
}

export async function getInstance(args: {
  organizationId: string;
  instanceId: string;
}) {
  return withOrganization(args.organizationId, async (db) => {
    const [row] = await db
      .select({
        instance: instances,
        typeSlug: documentTypes.slug,
        typeId: documentTypes.id,
      })
      .from(instances)
      .innerJoin(
        documentTypeVersions,
        eq(instances.documentTypeVersionId, documentTypeVersions.id),
      )
      .innerJoin(
        documentTypes,
        eq(documentTypeVersions.documentTypeId, documentTypes.id),
      )
      .where(
        and(
          eq(instances.id, args.instanceId),
          organizationEq(instances.organizationId, args.organizationId),
        ),
      )
      .limit(1);
    if (!row) {
      throw new InstanceNotFoundError();
    }
    return row;
  });
}

/** Sets issuedPdfKey only while it is still null (retry after a mid-generate failure). */
export async function attachIssuedPdfKey(args: {
  organizationId: string;
  instanceId: string;
  objectKey: string;
}) {
  return withOrganization(args.organizationId, async (db) => {
    const [updated] = await db
      .update(instances)
      .set({ issuedPdfKey: args.objectKey })
      .where(
        and(
          eq(instances.id, args.instanceId),
          organizationEq(instances.organizationId, args.organizationId),
          isNull(instances.issuedPdfKey),
        ),
      )
      .returning({
        id: instances.id,
        issuedPdfKey: instances.issuedPdfKey,
      });
    if (updated) {
      return updated;
    }
    const [existing] = await db
      .select({
        id: instances.id,
        issuedPdfKey: instances.issuedPdfKey,
      })
      .from(instances)
      .where(
        and(
          eq(instances.id, args.instanceId),
          organizationEq(instances.organizationId, args.organizationId),
        ),
      )
      .limit(1);
    if (!existing) {
      throw new InstanceNotFoundError();
    }
    return existing;
  });
}
