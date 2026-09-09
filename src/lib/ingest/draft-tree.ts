import { randomUUID } from "node:crypto";
import { emptyDraftSnapshot } from "@/lib/document-types/defaults";
import { stripLetterhead } from "@/lib/ingest/extract";
import {
  parseDocumentTypeVersionSnapshot,
  type DocumentTypeVersionSnapshot,
  type Field,
  type Inline,
} from "@/types/document-type";

export function segmentClauses(text: string) {
  return stripLetterhead(text)
    .split(/\n\s*\n|\n(?=\d+\.\s)/)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0);
}

export function clauseSlot(text: string) {
  const lower = text.toLowerCase();
  if (/salary|remuneration|compensation/.test(lower)) {
    return "salary";
  }
  if (/notice period/.test(lower)) {
    return "notice";
  }
  if (/confidential|non-disclosure/.test(lower)) {
    return "confidentiality";
  }
  return lower.replace(/\s+/g, " ").slice(0, 48);
}

function optionId(index: number) {
  return `option_${index}`;
}

function titleCase(value: string) {
  return value.replace(/^\w/, (char) => char.toUpperCase());
}

export function buildDraftTreeSnapshot(args: {
  name: string;
  texts: string[];
  branchTypes?: string[];
  discriminatorId?: string;
}): DocumentTypeVersionSnapshot {
  const snapshot = emptyDraftSnapshot();
  const heading = snapshot.template.blocks[0];
  if (heading?.children?.[0] && heading.children[0].type === "text") {
    heading.children[0].text = args.name;
  }
  snapshot.template.blocks = snapshot.template.blocks.filter(
    (block) => block.type === "heading",
  );

  const grouped = new Map<string, string[]>();
  for (const text of args.texts) {
    for (const clause of segmentClauses(text)) {
      const slot = clauseSlot(clause);
      const wordings = grouped.get(slot) ?? [];
      if (!wordings.includes(clause)) {
        wordings.push(clause);
      }
      grouped.set(slot, wordings);
    }
  }

  const extraFields: Field[] = [];
  for (const [slot, wordings] of grouped) {
    if (wordings.length > 1) {
      const fieldId = `${slot}Wording`;
      extraFields.push({
        id: fieldId,
        label: `${titleCase(slot)} wording`,
        type: "select",
        options: wordings.map((wording, index) => ({
          value: optionId(index),
          label: wording.slice(0, 80),
        })),
      });
      const variants: Record<string, string> = {};
      wordings.forEach((wording, index) => {
        variants[optionId(index)] = wording;
      });
      snapshot.template.blocks.push({
        id: randomUUID(),
        type: "paragraph",
        children: [
          {
            type: "variantMap",
            field: fieldId,
            variants,
          } satisfies Inline,
        ],
      });
    } else {
      snapshot.template.blocks.push({
        id: randomUUID(),
        type: "paragraph",
        children: [{ type: "text", text: wordings[0]! }],
      });
    }
  }

  if (extraFields.length > 0) {
    const details = snapshot.formSchema.groups[0];
    if (details) {
      details.fields = [...details.fields, ...extraFields];
    }
  }

  for (const type of args.branchTypes ?? []) {
    const groupId = randomUUID();
    snapshot.formSchema.groups.push({
      id: groupId,
      title: titleCase(type),
      visibleWhen: args.discriminatorId
        ? { op: "eq", field: args.discriminatorId, value: type }
        : undefined,
      fields: [],
    });
    snapshot.template.blocks.push({
      id: randomUUID(),
      type: "paragraph",
      includeWhen: args.discriminatorId
        ? { op: "eq", field: args.discriminatorId, value: type }
        : undefined,
      children: [{ type: "text", text: `${titleCase(type)} wording` }],
    });
  }

  return parseDocumentTypeVersionSnapshot(snapshot);
}
