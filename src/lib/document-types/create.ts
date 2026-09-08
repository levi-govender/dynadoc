import { z } from "zod";
import { documentTypes } from "@/lib/db/schema";
import { organizationEq, withOrganization } from "@/lib/db/tenant";
import { emptyDraftSnapshot } from "@/lib/document-types/defaults";

export class DocumentTypeSlugTakenError extends Error {
  constructor(message = "A document type with this slug already exists") {
    super(message);
    this.name = "DocumentTypeSlugTakenError";
  }
}

export const createDocumentTypeBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case"),
});

function isUniqueViolation(error: unknown) {
  const text =
    error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /unique|document_types_org_slug|23505/i.test(text);
}

export async function listDocumentTypes(organizationId: string) {
  return withOrganization(organizationId, async (db) =>
    db
      .select({
        id: documentTypes.id,
        name: documentTypes.name,
        slug: documentTypes.slug,
        status: documentTypes.status,
        createdAt: documentTypes.createdAt,
      })
      .from(documentTypes)
      .where(organizationEq(documentTypes.organizationId, organizationId))
      .orderBy(documentTypes.name),
  );
}

export async function createDocumentType(args: {
  organizationId: string;
  name: string;
  slug: string;
}) {
  const body = createDocumentTypeBodySchema.parse({
    name: args.name,
    slug: args.slug,
  });
  const snapshot = emptyDraftSnapshot();
  try {
    return await withOrganization(args.organizationId, async (db) => {
      const [row] = await db
        .insert(documentTypes)
        .values({
          organizationId: args.organizationId,
          name: body.name,
          slug: body.slug,
          status: "draft",
          draftSnapshot: snapshot,
        })
        .returning();
      if (!row) {
        throw new Error("Failed to create document type");
      }
      return row;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DocumentTypeSlugTakenError();
    }
    throw error;
  }
}
