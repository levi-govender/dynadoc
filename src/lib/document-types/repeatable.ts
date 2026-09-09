import type { Answers } from "@/lib/expr/evaluate";
import type { FieldGroup, FormSchema, Inline } from "@/types/document-type";

/** Cap operator row count so a template table cannot become a PDF bomb. */
export const REPEATABLE_MAX_ROWS = 50;

export function repeatableBindPath(groupId: string, fieldId: string) {
  return `${groupId}[].${fieldId}`;
}

export function parseRepeatableBind(field: string) {
  const marker = "[].";
  const index = field.indexOf(marker);
  if (index < 1) {
    return null;
  }
  return {
    groupId: field.slice(0, index),
    fieldId: field.slice(index + marker.length),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function repeatableRows(
  answers: Answers,
  groupId: string,
  cap = REPEATABLE_MAX_ROWS,
): Array<Record<string, unknown>> {
  const value = answers[groupId];
  if (!Array.isArray(value)) {
    return [];
  }
  const rows: Array<Record<string, unknown>> = [];
  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }
    rows.push(entry);
    if (rows.length >= cap) {
      break;
    }
  }
  return rows;
}

export function overlayRepeatableRow(
  answers: Answers,
  group: FieldGroup,
  row: Record<string, unknown>,
): Answers {
  const next: Answers = { ...answers };
  for (const field of group.fields) {
    if (Object.hasOwn(row, field.id)) {
      next[field.id] = row[field.id];
    }
    next[repeatableBindPath(group.id, field.id)] = row[field.id];
  }
  return next;
}

function bindingFieldsFromText(text: string) {
  const fields: string[] = [];
  const pattern = /\{\{([^}]+)\}\}/g;
  let match: RegExpExecArray | null = pattern.exec(text);
  while (match) {
    if (match[1]) {
      fields.push(match[1]);
    }
    match = pattern.exec(text);
  }
  return fields;
}

export function inlineBindingFields(inline: Inline): string[] {
  if (inline.type === "text") {
    return bindingFieldsFromText(inline.text);
  }
  return [inline.field];
}

export function expansionGroup(
  formSchema: FormSchema,
  inlines: Inline[],
): FieldGroup | null {
  const repeatableIds = new Set(
    formSchema.groups.filter((group) => group.repeatable).map((group) => group.id),
  );
  for (const inline of inlines) {
    for (const field of inlineBindingFields(inline)) {
      const parsed = parseRepeatableBind(field);
      if (parsed && repeatableIds.has(parsed.groupId)) {
        return (
          formSchema.groups.find((group) => group.id === parsed.groupId) ?? null
        );
      }
    }
  }
  return null;
}

export function listBindableFields(form: FormSchema) {
  return form.groups.flatMap((group) =>
    group.fields.map((field) => ({
      id: group.repeatable
        ? repeatableBindPath(group.id, field.id)
        : field.id,
      label: group.repeatable
        ? `${group.title} / ${field.label}`
        : field.label,
      type: field.type,
      options: field.type === "select" ? field.options : undefined,
      field,
      group,
    })),
  );
}
