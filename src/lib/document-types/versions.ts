import { and, eq, max } from "drizzle-orm";
import { ZodError } from "zod";
import {
  documentTypeVersions,
  documentTypes,
  instances,
} from "@/lib/db/schema";
import { organizationEq, withOrganization } from "@/lib/db/tenant";
import {
  parseDocumentTypeVersionSnapshot,
  type DocumentTypeVersionSnapshot,
} from "@/types/document-type";

export class DocumentTypeNotFoundError extends Error {
  constructor(message = "Document type not found") {
    super(message);
    this.name = "DocumentTypeNotFoundError";
  }
}

export class EmptyDraftError extends Error {
  constructor(message = "Document type has no draft to publish") {
    super(message);
    this.name = "EmptyDraftError";
  }
}

export class UnpublishedTypeError extends Error {
  constructor(message = "Document type has no published version") {
    super(message);
    this.name = "UnpublishedTypeError";
  }
}

export class PublishedVersionImmutableError extends Error {
  constructor(message = "Published version JSON cannot be mutated") {
    super(message);
    this.name = "PublishedVersionImmutableError";
  }
}

export function snapshotFromVersionColumns(row: {
  formSchema: unknown;
  template: unknown;
  styleTheme: unknown;
  expressionDialectVersion: number;
}): DocumentTypeVersionSnapshot {
  const formSchema = row.formSchema as { schemaVersion?: number } | null;
  return parseDocumentTypeVersionSnapshot({
    schemaVersion: formSchema?.schemaVersion ?? 1,
    expressionDialectVersion: row.expressionDialectVersion,
    formSchema: row.formSchema,
    template: row.template,
    styleTheme: row.styleTheme,
  });
}

/** Operators generate from the published row, never the current draft. */
export function snapshotForOperatorGenerate(args: {
  published: DocumentTypeVersionSnapshot;
  draft: DocumentTypeVersionSnapshot | null;
}) {
  void args.draft;
  return args.published;
}

export function assertPublishedVersionImmutable(): never {
  throw new PublishedVersionImmutableError();
}

export async function getDocumentType(args: {
  organizationId: string;
  documentTypeId: string;
}) {
  return withOrganization(args.organizationId, async (db) => {
    const [type] = await db
      .select()
      .from(documentTypes)
      .where(
        and(
          eq(documentTypes.id, args.documentTypeId),
          organizationEq(documentTypes.organizationId, args.organizationId),
        ),
      )
      .limit(1);
    if (!type) {
      throw new DocumentTypeNotFoundError();
    }
    return type;
  });
}

export async function saveDraft(args: {
  organizationId: string;
  documentTypeId: string;
  snapshot: unknown;
}) {
  const snapshot = parseDocumentTypeVersionSnapshot(args.snapshot);
  return withOrganization(args.organizationId, async (db) => {
    const [row] = await db
      .update(documentTypes)
      .set({ draftSnapshot: snapshot })
      .where(
        and(
          eq(documentTypes.id, args.documentTypeId),
          organizationEq(documentTypes.organizationId, args.organizationId),
        ),
      )
      .returning();
    if (!row) {
      throw new DocumentTypeNotFoundError();
    }
    return { type: row, snapshot };
  });
}

export async function publishDocumentType(args: {
  organizationId: string;
  documentTypeId: string;
  publishedBy: string;
}) {
  return withOrganization(args.organizationId, async (db) => {
    const [type] = await db
      .select()
      .from(documentTypes)
      .where(
        and(
          eq(documentTypes.id, args.documentTypeId),
          organizationEq(documentTypes.organizationId, args.organizationId),
        ),
      )
      .limit(1);
    if (!type) {
      throw new DocumentTypeNotFoundError();
    }
    if (type.draftSnapshot == null) {
      throw new EmptyDraftError();
    }
    const snapshot = parseDocumentTypeVersionSnapshot(type.draftSnapshot);

    const [maxRow] = await db
      .select({ n: max(documentTypeVersions.versionNumber) })
      .from(documentTypeVersions)
      .where(
        and(
          eq(documentTypeVersions.documentTypeId, args.documentTypeId),
          organizationEq(
            documentTypeVersions.organizationId,
            args.organizationId,
          ),
        ),
      );
    const versionNumber = (maxRow?.n ?? 0) + 1;

    const [version] = await db
      .insert(documentTypeVersions)
      .values({
        organizationId: args.organizationId,
        documentTypeId: args.documentTypeId,
        versionNumber,
        formSchema: snapshot.formSchema,
        template: snapshot.template,
        styleTheme: snapshot.styleTheme,
        expressionDialectVersion: snapshot.expressionDialectVersion,
      })
      .returning();
    if (!version) {
      throw new Error("Failed to insert document type version");
    }

    const [updated] = await db
      .update(documentTypes)
      .set({
        publishedVersionId: version.id,
        publishedAt: new Date(),
        publishedBy: args.publishedBy,
        status: "published",
      })
      .where(
        and(
          eq(documentTypes.id, args.documentTypeId),
          organizationEq(documentTypes.organizationId, args.organizationId),
        ),
      )
      .returning();

    return { type: updated ?? type, version, snapshot };
  });
}

export async function getPublishedSnapshot(args: {
  organizationId: string;
  documentTypeId: string;
}) {
  return withOrganization(args.organizationId, async (db) => {
    const [type] = await db
      .select()
      .from(documentTypes)
      .where(
        and(
          eq(documentTypes.id, args.documentTypeId),
          organizationEq(documentTypes.organizationId, args.organizationId),
        ),
      )
      .limit(1);
    if (!type) {
      throw new DocumentTypeNotFoundError();
    }
    if (!type.publishedVersionId) {
      throw new UnpublishedTypeError();
    }
    const [version] = await db
      .select()
      .from(documentTypeVersions)
      .where(
        and(
          eq(documentTypeVersions.id, type.publishedVersionId),
          organizationEq(
            documentTypeVersions.organizationId,
            args.organizationId,
          ),
        ),
      )
      .limit(1);
    if (!version) {
      throw new UnpublishedTypeError();
    }
    const snapshot = snapshotFromVersionColumns(version);
    return { type, version, snapshot };
  });
}

export async function createInstanceFromPublished(args: {
  organizationId: string;
  documentTypeId: string;
  createdBy: string;
  answers?: unknown;
}) {
  const published = await getPublishedSnapshot(args);
  let draft: DocumentTypeVersionSnapshot | null = null;
  if (published.type.draftSnapshot != null) {
    try {
      draft = parseDocumentTypeVersionSnapshot(published.type.draftSnapshot);
    } catch {
      draft = null;
    }
  }
  const snapshot = snapshotForOperatorGenerate({
    published: published.snapshot,
    draft,
  });

  return withOrganization(args.organizationId, async (db) => {
    const [instance] = await db
      .insert(instances)
      .values({
        organizationId: args.organizationId,
        documentTypeVersionId: published.version.id,
        answers: args.answers ?? {},
        resolvedAst: { pending: true },
        createdBy: args.createdBy,
      })
      .returning();
    if (!instance) {
      throw new Error("Failed to create instance");
    }
    return { instance, snapshot, version: published.version };
  });
}

export function isDocumentTypeClientError(error: unknown) {
  return (
    error instanceof DocumentTypeNotFoundError ||
    error instanceof EmptyDraftError ||
    error instanceof UnpublishedTypeError ||
    error instanceof PublishedVersionImmutableError ||
    error instanceof ZodError
  );
}

export function documentTypeErrorStatus(error: unknown): number {
  if (error instanceof DocumentTypeNotFoundError) {
    return 404;
  }
  if (error instanceof PublishedVersionImmutableError) {
    return 409;
  }
  if (error instanceof UnpublishedTypeError) {
    return 409;
  }
  if (error instanceof EmptyDraftError || error instanceof ZodError) {
    return 400;
  }
  return 500;
}
