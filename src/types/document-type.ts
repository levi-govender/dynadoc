import { z } from "zod";

const schemaVersion = z.number().int().positive();
const identifier = z.string().min(1);

const literalValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export type Expr =
  | { op: "eq"; field: string; value: string | number | boolean | null }
  | { op: "in"; field: string; values: Array<string | number> }
  | { op: "exists"; field: string }
  | { op: "not"; expr: Expr }
  | { op: "and"; exprs: Expr[] }
  | { op: "or"; exprs: Expr[] };

export const exprSchema: z.ZodType<Expr> = z.lazy(() =>
  z.discriminatedUnion("op", [
    z.object({
      op: z.literal("eq"),
      field: identifier,
      value: literalValue,
    }),
    z.object({
      op: z.literal("in"),
      field: identifier,
      values: z.array(z.union([z.string(), z.number()])),
    }),
    z.object({
      op: z.literal("exists"),
      field: identifier,
    }),
    z.object({
      op: z.literal("not"),
      expr: exprSchema,
    }),
    z.object({
      op: z.literal("and"),
      exprs: z.array(exprSchema).min(1),
    }),
    z.object({
      op: z.literal("or"),
      exprs: z.array(exprSchema).min(1),
    }),
  ]),
);

const selectOptionSchema = z.object({
  value: identifier,
  label: z.string().min(1),
  activatesGroupIds: z.array(identifier).optional(),
});

const fieldBase = {
  id: identifier,
  label: z.string().min(1),
  required: z.boolean().optional(),
  visibleWhen: exprSchema.optional(),
};

export const fieldSchema = z.discriminatedUnion("type", [
  z.object({ ...fieldBase, type: z.literal("text") }),
  z.object({ ...fieldBase, type: z.literal("textarea") }),
  z.object({
    ...fieldBase,
    type: z.literal("select"),
    options: z.array(selectOptionSchema).min(1),
  }),
  z.object({ ...fieldBase, type: z.literal("number") }),
  z.object({ ...fieldBase, type: z.literal("date") }),
  z.object({ ...fieldBase, type: z.literal("boolean") }),
]);

export type Field = z.infer<typeof fieldSchema>;

export const fieldGroupSchema = z.object({
  id: identifier,
  title: z.string().min(1),
  visibleWhen: exprSchema.optional(),
  repeatable: z.boolean().optional(),
  fields: z.array(fieldSchema),
});

export type FieldGroup = z.infer<typeof fieldGroupSchema>;

export const formValidationSchema = z.object({
  id: identifier,
  message: z.string().min(1),
  op: z.enum(["gt", "gte", "lt", "lte"]),
  left: identifier,
  right: identifier,
});

export type FormValidation = z.infer<typeof formValidationSchema>;

export const formSchemaSchema = z.object({
  schemaVersion,
  groups: z.array(fieldGroupSchema),
  validations: z.array(formValidationSchema).optional(),
});

export type FormSchema = z.infer<typeof formSchemaSchema>;

export const inlineSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("bind"), field: identifier }),
  z.object({
    type: z.literal("variantMap"),
    field: identifier,
    variants: z.record(z.string(), z.string()),
  }),
]);

export type Inline = z.infer<typeof inlineSchema>;

export const blockSchema = z.object({
  id: identifier,
  type: z.enum([
    "heading",
    "paragraph",
    "list",
    "table",
    "pageBreak",
    "signature",
    "initials",
  ]),
  includeWhen: exprSchema.optional(),
  children: z.array(inlineSchema).optional(),
});

export type Block = z.infer<typeof blockSchema>;

export const templateSchema = z.object({
  schemaVersion,
  blocks: z.array(blockSchema),
});

export type Template = z.infer<typeof templateSchema>;

export const marginsSchema = z.object({
  top: z.number(),
  right: z.number(),
  bottom: z.number(),
  left: z.number(),
});

export const fontSpecSchema = z.object({
  family: z.string().min(1),
  size: z.number().positive(),
  weight: z.union([z.number(), z.string()]).optional(),
});

export const signatureSlotSchema = z.object({
  id: identifier,
  partyLabel: z.string().min(1),
  kind: z.enum(["signature", "initials"]).optional(),
  includeTitle: z.boolean().optional(),
  includeDate: z.boolean().optional(),
  partyNameField: identifier.optional(),
  titleField: identifier.optional(),
  dateField: identifier.optional(),
  imageField: identifier.optional(),
  imageAssetId: z.string().optional(),
});

export const styleThemeSchema = z.object({
  schemaVersion,
  page: z.object({
    size: z.enum(["A4", "Letter"]),
    margins: marginsSchema,
  }),
  typography: z.object({
    body: fontSpecSchema,
    heading: fontSpecSchema,
  }),
  letterhead: z.object({
    logoAssetId: z.string().optional(),
    headerHtml: z.string().optional(),
    footerMode: z.enum(["pageNumbers", "letterhead"]),
  }),
  signatures: z.object({
    blocks: z.array(signatureSlotSchema),
  }),
});

export type StyleTheme = z.infer<typeof styleThemeSchema>;
export type SignatureSlot = z.infer<typeof signatureSlotSchema>;

export const documentTypeVersionSnapshotSchema = z.object({
  schemaVersion,
  expressionDialectVersion: z.number().int().positive(),
  formSchema: formSchemaSchema,
  template: templateSchema,
  styleTheme: styleThemeSchema,
});

export type DocumentTypeVersionSnapshot = z.infer<
  typeof documentTypeVersionSnapshotSchema
>;

export function parseDocumentTypeVersionSnapshot(input: unknown) {
  return documentTypeVersionSnapshotSchema.parse(input);
}

export function documentTypeVersionJsonSchema() {
  return documentTypeVersionSnapshotSchema.toJSONSchema();
}
