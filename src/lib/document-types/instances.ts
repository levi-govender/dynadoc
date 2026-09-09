import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { z } from "zod";
import {
  documentTypeVersions,
  documentTypes,
  instances,
  user,
} from "@/lib/db/schema";
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

export const instanceListQuerySchema = z.object({
  documentTypeId: z.string().uuid().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export type InstanceListQuery = z.infer<typeof instanceListQuerySchema>;

export function parseInstanceListQuery(
  search: Record<string, string | string[] | undefined>,
): InstanceListQuery {
  const one = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const raw = {
    documentTypeId: one(search.documentTypeId) || undefined,
    from: one(search.from) || undefined,
    to: one(search.to) || undefined,
  };
  return instanceListQuerySchema.parse(raw);
}

export async function listInstances(args: {
  organizationId: string;
  documentTypeId?: string;
  from?: string;
  to?: string;
}) {
  return withOrganization(args.organizationId, async (db) => {
    const filters = [
      organizationEq(instances.organizationId, args.organizationId),
    ];
    if (args.documentTypeId) {
      filters.push(eq(documentTypes.id, args.documentTypeId));
    }
    if (args.from) {
      filters.push(gte(instances.createdAt, new Date(`${args.from}T00:00:00.000Z`)));
    }
    if (args.to) {
      filters.push(lte(instances.createdAt, new Date(`${args.to}T23:59:59.999Z`)));
    }
    return db
      .select({
        id: instances.id,
        createdAt: instances.createdAt,
        createdById: instances.createdBy,
        createdByName: user.name,
        createdByEmail: user.email,
        issuedPdfKey: instances.issuedPdfKey,
        typeId: documentTypes.id,
        typeName: documentTypes.name,
        typeSlug: documentTypes.slug,
        versionNumber: documentTypeVersions.versionNumber,
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
      .leftJoin(user, eq(instances.createdBy, user.id))
      .where(and(...filters))
      .orderBy(desc(instances.createdAt));
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
