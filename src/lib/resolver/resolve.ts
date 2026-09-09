import { evaluate, readAnswer, type Answers } from "@/lib/expr/evaluate";
import {
  expansionGroup,
  overlayRepeatableRow,
  repeatableRows,
} from "@/lib/document-types/repeatable";
import type {
  Block,
  DocumentTypeVersionSnapshot,
  Field,
  FieldGroup,
  FormSchema,
  Inline,
} from "@/types/document-type";

export class GroupActivationCycleError extends Error {
  constructor(message = "Field group activation contains a cycle") {
    super(message);
    this.name = "GroupActivationCycleError";
  }
}

export type ResolveWarning = {
  field: string;
  placeholder: string;
};

export type ResolvedSpan = { type: "text"; text: string };

export type ResolvedBlock = {
  id: string;
  type: Block["type"];
  children?: ResolvedSpan[];
  rows?: ResolvedSpan[][];
};

export type ResolvedDocument = {
  blocks: ResolvedBlock[];
};

export type ResolveResult = {
  answers: Answers;
  document: ResolvedDocument;
  warnings: ResolveWarning[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asAnswers(value: unknown): Answers {
  return isRecord(value) ? { ...value } : {};
}

function placeholder(field: string) {
  return `{{${field}}}`;
}

function noteWarning(
  warnings: ResolveWarning[],
  field: string,
  token: string,
) {
  if (
    warnings.some(
      (warning) => warning.field === field && warning.placeholder === token,
    )
  ) {
    return;
  }
  warnings.push({ field, placeholder: token });
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function activationEdges(formSchema: FormSchema) {
  const groupIds = new Set(formSchema.groups.map((group) => group.id));
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  for (const group of formSchema.groups) {
    outgoing.set(group.id, []);
    indegree.set(group.id, 0);
  }

  for (const group of formSchema.groups) {
    for (const field of group.fields) {
      if (field.type !== "select") {
        continue;
      }
      for (const option of field.options) {
        for (const targetId of option.activatesGroupIds ?? []) {
          if (!groupIds.has(targetId)) {
            continue;
          }
          const list = outgoing.get(group.id) ?? [];
          if (!list.includes(targetId)) {
            list.push(targetId);
            outgoing.set(group.id, list);
            indegree.set(targetId, (indegree.get(targetId) ?? 0) + 1);
          }
        }
      }
    }
  }

  return { outgoing, indegree };
}

function topologicalGroups(formSchema: FormSchema): FieldGroup[] {
  const { outgoing, indegree } = activationEdges(formSchema);
  const remaining = new Map(indegree);
  const byId = new Map(formSchema.groups.map((group) => [group.id, group]));
  const ordered: FieldGroup[] = [];
  const queue = formSchema.groups.filter(
    (group) => (remaining.get(group.id) ?? 0) === 0,
  );

  while (queue.length > 0) {
    const group = queue.shift();
    if (!group) {
      break;
    }
    ordered.push(group);
    for (const targetId of outgoing.get(group.id) ?? []) {
      const nextDegree = (remaining.get(targetId) ?? 0) - 1;
      remaining.set(targetId, nextDegree);
      if (nextDegree === 0) {
        const target = byId.get(targetId);
        if (target) {
          queue.push(target);
        }
      }
    }
  }

  if (ordered.length !== formSchema.groups.length) {
    throw new GroupActivationCycleError();
  }
  return ordered;
}

function selectedOption(field: Field, answers: Answers) {
  if (field.type !== "select") {
    return undefined;
  }
  const { missing, value } = readAnswer(answers, field.id);
  if (missing) {
    return undefined;
  }
  return field.options.find((option) => option.value === value);
}

function fieldIsVisible(field: Field, answers: Answers) {
  if (!field.visibleWhen) {
    return true;
  }
  return evaluate(field.visibleWhen, answers);
}

function groupIsVisible(group: FieldGroup, answers: Answers) {
  if (!group.visibleWhen) {
    return true;
  }
  return evaluate(group.visibleWhen, answers);
}

export function activeFieldGroups(
  formSchema: FormSchema,
  answers: Answers,
): Set<string> {
  const { indegree } = activationEdges(formSchema);
  const ordered = topologicalGroups(formSchema);
  const activated = new Set<string>();
  const active = new Set<string>();

  for (const group of ordered) {
    const needsActivation = (indegree.get(group.id) ?? 0) > 0;
    const parentOk = !needsActivation || activated.has(group.id);
    if (!parentOk || !groupIsVisible(group, answers)) {
      continue;
    }
    active.add(group.id);
    for (const field of group.fields) {
      if (!fieldIsVisible(field, answers)) {
        continue;
      }
      const option = selectedOption(field, answers);
      for (const targetId of option?.activatesGroupIds ?? []) {
        activated.add(targetId);
      }
    }
  }

  return active;
}

export function stripInactiveAnswers(
  formSchema: FormSchema,
  answers: Answers,
  activeGroups: Set<string>,
): Answers {
  const kept: Answers = {};
  for (const group of formSchema.groups) {
    if (!activeGroups.has(group.id)) {
      continue;
    }
    if (group.repeatable) {
      kept[group.id] = repeatableRows(
        answers,
        group.id,
        Number.POSITIVE_INFINITY,
      ).map((row) => {
        const keptRow: Record<string, unknown> = {};
        for (const field of group.fields) {
          if (!fieldIsVisible(field, answers)) {
            continue;
          }
          if (Object.hasOwn(row, field.id)) {
            keptRow[field.id] = row[field.id];
          }
        }
        return keptRow;
      });
      continue;
    }
    for (const field of group.fields) {
      if (!fieldIsVisible(field, answers)) {
        continue;
      }
      if (Object.hasOwn(answers, field.id)) {
        kept[field.id] = answers[field.id];
      }
    }
  }
  return kept;
}

const BINDING = /\{\{([^}]+)\}\}/g;

function interpolateText(
  text: string,
  answers: Answers,
  warnings: ResolveWarning[],
): string {
  return text.replace(BINDING, (match, field: string) => {
    const { missing, value } = readAnswer(answers, field);
    if (missing || value === null) {
      noteWarning(warnings, field, match);
      return match;
    }
    return formatValue(value);
  });
}

function resolveInline(
  inline: Inline,
  answers: Answers,
  warnings: ResolveWarning[],
): ResolvedSpan {
  if (inline.type === "text") {
    return {
      type: "text",
      text: interpolateText(inline.text, answers, warnings),
    };
  }
  if (inline.type === "bind") {
    const { missing, value } = readAnswer(answers, inline.field);
    if (missing || value === null) {
      const token = placeholder(inline.field);
      noteWarning(warnings, inline.field, token);
      return { type: "text", text: token };
    }
    return { type: "text", text: formatValue(value) };
  }

  const { missing, value } = readAnswer(answers, inline.field);
  if (!missing && typeof value === "string" && value in inline.variants) {
    return {
      type: "text",
      text: interpolateText(inline.variants[value] ?? "", answers, warnings),
    };
  }
  const token = placeholder(inline.field);
  noteWarning(warnings, inline.field, token);
  return { type: "text", text: token };
}

function resolveBlock(
  block: Block,
  answers: Answers,
  formSchema: FormSchema,
  warnings: ResolveWarning[],
): ResolvedBlock | null {
  if (block.includeWhen && !evaluate(block.includeWhen, answers)) {
    return null;
  }
  const inlines = block.children ?? [];
  const group = expansionGroup(formSchema, inlines);
  if (group) {
    const rows = repeatableRows(answers, group.id).map((row) =>
      inlines.map((inline) =>
        resolveInline(
          inline,
          overlayRepeatableRow(answers, group, row),
          warnings,
        ),
      ),
    );
    const resolved: ResolvedBlock = { id: block.id, type: block.type, rows };
    if (rows[0]) {
      resolved.children = rows[0];
    }
    return resolved;
  }
  const children = inlines.map((inline) =>
    resolveInline(inline, answers, warnings),
  );
  const resolved: ResolvedBlock = { id: block.id, type: block.type };
  if (children.length > 0) {
    resolved.children = children;
  }
  return resolved;
}

/** Pure resolver: one topological pass over group activation, then template include-when. */
export function resolveDocument(
  snapshot: DocumentTypeVersionSnapshot,
  answersInput: unknown,
): ResolveResult {
  const incoming = asAnswers(answersInput);
  const activeGroups = activeFieldGroups(snapshot.formSchema, incoming);
  const answers = stripInactiveAnswers(
    snapshot.formSchema,
    incoming,
    activeGroups,
  );
  const warnings: ResolveWarning[] = [];
  const blocks: ResolvedBlock[] = [];

  for (const block of snapshot.template.blocks) {
    const resolved = resolveBlock(
      block,
      answers,
      snapshot.formSchema,
      warnings,
    );
    if (resolved) {
      blocks.push(resolved);
    }
  }

  return {
    answers,
    document: { blocks },
    warnings,
  };
}
