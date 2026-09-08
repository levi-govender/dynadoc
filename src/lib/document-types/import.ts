import { randomUUID } from "node:crypto";
import { z } from "zod";
import { documentFamilies, documentTypes } from "@/lib/db/schema";
import { withOrganization } from "@/lib/db/tenant";
import { createDocumentType } from "@/lib/document-types/create";
import { documentTypeExportSchema } from "@/lib/document-types/export";
import {
  documentTypeVersionSnapshotSchema,
  fieldGroupSchema,
  type DocumentTypeVersionSnapshot,
  type Expr,
} from "@/types/document-type";

const memberSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  snapshot: documentTypeVersionSnapshotSchema,
});

export const familyBundleSchema = z.object({
  kind: z.literal("family"),
  name: z.string().min(1),
  slug: z.string().min(1),
  discriminator: z.unknown().optional(),
  sharedFieldGroups: z.array(fieldGroupSchema).optional(),
  members: z.array(memberSchema).min(1),
});

export type FamilyBundle = z.infer<typeof familyBundleSchema>;

export type ParsedImport =
  | { kind: "documentType"; name: string; slug: string; snapshot: DocumentTypeVersionSnapshot }
  | FamilyBundle;

export function parseImportPayload(input: unknown): ParsedImport {
  const family = familyBundleSchema.safeParse(input);
  if (family.success) {
    return family.data;
  }
  const exported = documentTypeExportSchema.safeParse(input);
  if (exported.success) {
    return {
      kind: "documentType",
      name: exported.data.name,
      slug: exported.data.slug,
      snapshot: exported.data.snapshot,
    };
  }
  const typed = z
    .object({
      kind: z.literal("documentType").optional(),
      name: z.string().min(1),
      slug: z.string().min(1),
      snapshot: documentTypeVersionSnapshotSchema,
    })
    .safeParse(input);
  if (typed.success) {
    return {
      kind: "documentType",
      name: typed.data.name,
      slug: typed.data.slug,
      snapshot: typed.data.snapshot,
    };
  }
  if (family.error) {
    throw family.error;
  }
  throw exported.error;
}

function remapExpr(expr: Expr, ids: Map<string, string>): Expr {
  switch (expr.op) {
    case "eq":
    case "exists":
      return { ...expr, field: ids.get(expr.field) ?? expr.field };
    case "in":
      return { ...expr, field: ids.get(expr.field) ?? expr.field };
    case "not":
      return { op: "not", expr: remapExpr(expr.expr, ids) };
    case "and":
      return { op: "and", exprs: expr.exprs.map((item) => remapExpr(item, ids)) };
    case "or":
      return { op: "or", exprs: expr.exprs.map((item) => remapExpr(item, ids)) };
  }
}

function nextId(old: string, ids: Map<string, string>) {
  const existing = ids.get(old);
  if (existing) {
    return existing;
  }
  const created = randomUUID();
  ids.set(old, created);
  return created;
}

export function remapSnapshot(
  snapshot: DocumentTypeVersionSnapshot,
): DocumentTypeVersionSnapshot {
  const ids = new Map<string, string>();
  const groups = snapshot.formSchema.groups.map((group) => ({
    ...group,
    id: nextId(group.id, ids),
    visibleWhen: group.visibleWhen
      ? remapExpr(group.visibleWhen, ids)
      : undefined,
    fields: group.fields.map((field) => {
      const id = nextId(field.id, ids);
      if (field.type === "select") {
        return {
          ...field,
          id,
          visibleWhen: field.visibleWhen
            ? remapExpr(field.visibleWhen, ids)
            : undefined,
          options: field.options.map((option) => ({
            ...option,
            activatesGroupIds: option.activatesGroupIds?.map((groupId) =>
              nextId(groupId, ids),
            ),
          })),
        };
      }
      return {
        ...field,
        id,
        visibleWhen: field.visibleWhen
          ? remapExpr(field.visibleWhen, ids)
          : undefined,
      };
    }),
  }));

  const remappedGroups = groups.map((group) => ({
    ...group,
    visibleWhen: group.visibleWhen
      ? remapExpr(group.visibleWhen, ids)
      : undefined,
    fields: group.fields.map((field) => ({
      ...field,
      visibleWhen: field.visibleWhen
        ? remapExpr(field.visibleWhen, ids)
        : undefined,
      ...(field.type === "select"
        ? {
            options: field.options.map((option) => ({
              ...option,
              activatesGroupIds: option.activatesGroupIds?.map(
                (groupId) => ids.get(groupId) ?? groupId,
              ),
            })),
          }
        : {}),
    })),
  }));

  return {
    ...snapshot,
    formSchema: { ...snapshot.formSchema, groups: remappedGroups },
    template: {
      ...snapshot.template,
      blocks: snapshot.template.blocks.map((block) => ({
        ...block,
        id: nextId(block.id, ids),
        includeWhen: block.includeWhen
          ? remapExpr(block.includeWhen, ids)
          : undefined,
        children: block.children?.map((child) => {
          if (child.type === "bind" || child.type === "variantMap") {
            return { ...child, field: ids.get(child.field) ?? child.field };
          }
          return child;
        }),
      })),
    },
    styleTheme: {
      ...snapshot.styleTheme,
      signatures: {
        blocks: snapshot.styleTheme.signatures.blocks.map((slot) => ({
          ...slot,
          id: nextId(slot.id, ids),
        })),
      },
    },
  };
}

function slugifyBase(slug: string) {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function uniqueTypeSlug(organizationId: string, desired: string) {
  const base = slugifyBase(desired) || "imported";
  return withOrganization(organizationId, async (db) => {
    const existing = await db
      .select({ slug: documentTypes.slug })
      .from(documentTypes);
    const taken = new Set(existing.map((row) => row.slug));
    if (!taken.has(base)) {
      return base;
    }
    for (let i = 2; i < 1000; i += 1) {
      const candidate = `${base}-${i}`;
      if (!taken.has(candidate)) {
        return candidate;
      }
    }
    return `${base}-${randomUUID().slice(0, 8)}`;
  });
}

async function uniqueFamilySlug(organizationId: string, desired: string) {
  const base = slugifyBase(desired) || "family";
  return withOrganization(organizationId, async (db) => {
    const existing = await db
      .select({ slug: documentFamilies.slug })
      .from(documentFamilies);
    const taken = new Set(existing.map((row) => row.slug));
    if (!taken.has(base)) {
      return base;
    }
    for (let i = 2; i < 1000; i += 1) {
      const candidate = `${base}-${i}`;
      if (!taken.has(candidate)) {
        return candidate;
      }
    }
    return `${base}-${randomUUID().slice(0, 8)}`;
  });
}

export async function importFromJson(args: {
  organizationId: string;
  payload: unknown;
}) {
  const parsed = parseImportPayload(args.payload);
  if (parsed.kind === "family") {
    const familySlug = await uniqueFamilySlug(args.organizationId, parsed.slug);
    const family = await withOrganization(args.organizationId, async (db) => {
      const [row] = await db
        .insert(documentFamilies)
        .values({
          organizationId: args.organizationId,
          name: parsed.name,
          slug: familySlug,
          discriminator: parsed.discriminator ?? null,
          sharedFieldGroups: parsed.sharedFieldGroups ?? null,
        })
        .returning();
      if (!row) {
        throw new Error("Failed to create document family");
      }
      return row;
    });
    const types = [];
    for (const member of parsed.members) {
      const slug = await uniqueTypeSlug(args.organizationId, member.slug);
      const type = await createDocumentType({
        organizationId: args.organizationId,
        name: member.name,
        slug,
        familyId: family.id,
        snapshot: remapSnapshot(member.snapshot),
      });
      types.push({ id: type.id, name: type.name, slug: type.slug, status: type.status });
    }
    return {
      kind: "family" as const,
      family: { id: family.id, name: family.name, slug: family.slug },
      types,
    };
  }

  const slug = await uniqueTypeSlug(args.organizationId, parsed.slug);
  const type = await createDocumentType({
    organizationId: args.organizationId,
    name: parsed.name,
    slug,
    snapshot: remapSnapshot(parsed.snapshot),
  });
  return {
    kind: "documentType" as const,
    family: null,
    types: [{ id: type.id, name: type.name, slug: type.slug, status: type.status }],
  };
}
