import type { Block, Expr, Inline, Template } from "@/types/document-type";
import { templateSchema } from "@/types/document-type";

export const BLOCK_TYPES = [
  "heading",
  "paragraph",
  "list",
  "table",
  "pageBreak",
  "signature",
  "initials",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

function newId() {
  return crypto.randomUUID();
}

function defaultChildren(type: BlockType): Inline[] | undefined {
  if (type === "heading") {
    return [{ type: "text", text: "Heading" }];
  }
  if (type === "paragraph") {
    return [{ type: "text", text: "Paragraph" }];
  }
  if (type === "list") {
    return [{ type: "text", text: "List item" }];
  }
  if (type === "table") {
    return [{ type: "text", text: "Table cell" }];
  }
  return undefined;
}

export function addBlock(template: Template, type: BlockType): Template {
  const children = defaultChildren(type);
  const block: Block = children
    ? { id: newId(), type, children }
    : { id: newId(), type };
  return { ...template, blocks: [...template.blocks, block] };
}

export function deleteBlock(template: Template, blockId: string): Template {
  return {
    ...template,
    blocks: template.blocks.filter((block) => block.id !== blockId),
  };
}

export function moveBlock(
  template: Template,
  blockId: string,
  delta: number,
): Template {
  const index = template.blocks.findIndex((block) => block.id === blockId);
  if (index < 0) {
    return template;
  }
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= template.blocks.length) {
    return template;
  }
  const blocks = [...template.blocks];
  const [removed] = blocks.splice(index, 1);
  if (!removed) {
    return template;
  }
  blocks.splice(nextIndex, 0, removed);
  return { ...template, blocks };
}

export function setBlockText(
  template: Template,
  blockId: string,
  text: string,
): Template {
  return {
    ...template,
    blocks: template.blocks.map((block) =>
      block.id === blockId
        ? { ...block, children: [{ type: "text" as const, text }] }
        : block,
    ),
  };
}

export function childrenArePlainText(children: Inline[] | undefined) {
  if (!children || children.length === 0) {
    return true;
  }
  return children.every((child) => child.type === "text");
}

export function flattenText(children: Inline[] | undefined) {
  if (!children) {
    return "";
  }
  return children
    .map((child) => (child.type === "text" ? child.text : ""))
    .join("");
}

function exprFields(expr: Expr | undefined, into: Set<string>) {
  if (!expr) {
    return;
  }
  if (expr.op === "eq" || expr.op === "in" || expr.op === "exists") {
    into.add(expr.field);
    return;
  }
  if (expr.op === "not") {
    exprFields(expr.expr, into);
    return;
  }
  for (const nested of expr.exprs) {
    exprFields(nested, into);
  }
}

export function blockReferencesField(block: Block, fieldId: string) {
  const fields = new Set<string>();
  exprFields(block.includeWhen, fields);
  for (const child of block.children ?? []) {
    if (child.type === "bind" || child.type === "variantMap") {
      fields.add(child.field);
    }
  }
  return fields.has(fieldId);
}

export function parseTemplate(input: unknown): Template {
  return templateSchema.parse(input);
}
