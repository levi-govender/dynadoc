import { z } from "zod";
import {
  documentTypeVersionSnapshotSchema,
  parseDocumentTypeVersionSnapshot,
} from "@/types/document-type";
import {
  EmptyDraftError,
  getDocumentType,
  getPublishedSnapshot,
} from "@/lib/document-types/versions";

export const documentTypeExportSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  source: z.enum(["draft", "published"]),
  snapshot: documentTypeVersionSnapshotSchema,
});

export type DocumentTypeExport = z.infer<typeof documentTypeExportSchema>;

export function parseDocumentTypeExport(input: unknown): DocumentTypeExport {
  return documentTypeExportSchema.parse(input);
}

/** Import ticket will parse this same payload; snapshot must be lossless Zod JSON. */
export function snapshotFromExport(exported: DocumentTypeExport) {
  return parseDocumentTypeVersionSnapshot(exported.snapshot);
}

export async function exportDocumentType(args: {
  organizationId: string;
  documentTypeId: string;
  source: "draft" | "published";
}): Promise<DocumentTypeExport> {
  if (args.source === "published") {
    const published = await getPublishedSnapshot({
      organizationId: args.organizationId,
      documentTypeId: args.documentTypeId,
    });
    return {
      name: published.type.name,
      slug: published.type.slug,
      source: "published",
      snapshot: published.snapshot,
    };
  }

  const type = await getDocumentType({
    organizationId: args.organizationId,
    documentTypeId: args.documentTypeId,
  });
  if (type.draftSnapshot == null) {
    throw new EmptyDraftError();
  }
  const snapshot = parseDocumentTypeVersionSnapshot(type.draftSnapshot);
  return {
    name: type.name,
    slug: type.slug,
    source: "draft",
    snapshot,
  };
}
