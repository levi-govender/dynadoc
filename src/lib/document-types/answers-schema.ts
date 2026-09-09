import { z, ZodError } from "zod";
import { samplePreview } from "@/lib/document-types/branching";
import { REPEATABLE_MAX_ROWS } from "@/lib/document-types/repeatable";
import type { Answers } from "@/lib/expr/evaluate";
import type { Field, FormSchema, FormValidation } from "@/types/document-type";

const answersRecordSchema = z.record(z.string(), z.unknown());

export type OperatorIssue = {
  fieldId?: string;
  message: string;
};

export class OperatorAnswersError extends Error {
  readonly issues: OperatorIssue[];

  constructor(issues: OperatorIssue[]) {
    super(issues[0]?.message ?? "Answers are invalid");
    this.name = "OperatorAnswersError";
    this.issues = issues;
  }
}

function fieldValueSchema(field: Field) {
  let value: z.ZodType;
  switch (field.type) {
    case "number":
      value = z.number();
      break;
    case "boolean":
      value = z.boolean();
      break;
    case "select": {
      const options = field.options.map((option) => option.value);
      value = z.enum(options as [string, ...string[]]);
      break;
    }
    default:
      value = z.string().min(1);
  }
  if (field.required) {
    return value;
  }
  return z.preprocess(
    (entry) => (entry === "" || entry === undefined ? undefined : entry),
    value.optional(),
  );
}

function operatorAnswersSchema(
  form: FormSchema,
  preview: ReturnType<typeof samplePreview>,
) {
  const shape: Record<string, z.ZodType> = {};
  const fieldsByGroup = new Map<string, Field[]>();
  for (const entry of preview.fields) {
    const list = fieldsByGroup.get(entry.group.id) ?? [];
    list.push(entry.field);
    fieldsByGroup.set(entry.group.id, list);
  }
  for (const group of form.groups) {
    if (!preview.activeGroups.has(group.id)) {
      continue;
    }
    const fields = fieldsByGroup.get(group.id) ?? [];
    if (group.repeatable) {
      const rowShape: Record<string, z.ZodType> = {};
      for (const field of fields) {
        rowShape[field.id] = fieldValueSchema(field);
      }
      let rows = z.array(z.object(rowShape)).max(REPEATABLE_MAX_ROWS);
      if (fields.some((field) => field.required)) {
        rows = rows.min(1);
      }
      shape[group.id] = rows;
      continue;
    }
    for (const field of fields) {
      shape[field.id] = fieldValueSchema(field);
    }
  }
  return z.object(shape);
}

function comparable(value: unknown): number | string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value !== "") {
    return value;
  }
  return null;
}

function compareValues(
  op: FormValidation["op"],
  left: number | string,
  right: number | string,
): boolean {
  if (typeof left === "number" && typeof right === "number") {
    switch (op) {
      case "gt":
        return left > right;
      case "gte":
        return left >= right;
      case "lt":
        return left < right;
      case "lte":
        return left <= right;
    }
  }
  if (typeof left === "string" && typeof right === "string") {
    switch (op) {
      case "gt":
        return left > right;
      case "gte":
        return left >= right;
      case "lt":
        return left < right;
      case "lte":
        return left <= right;
    }
  }
  return false;
}

function visibleFieldIds(form: FormSchema, answers: Answers) {
  const preview = samplePreview(form, answers);
  return new Set(preview.fields.map((entry) => entry.field.id));
}

function validationIssues(form: FormSchema, answers: Answers): OperatorIssue[] {
  const visible = visibleFieldIds(form, answers);
  const issues: OperatorIssue[] = [];
  for (const rule of form.validations ?? []) {
    if (!visible.has(rule.left) || !visible.has(rule.right)) {
      continue;
    }
    const left = comparable(answers[rule.left]);
    const right = comparable(answers[rule.right]);
    if (left === null || right === null) {
      continue;
    }
    if (!compareValues(rule.op, left, right)) {
      issues.push({ fieldId: rule.left, message: rule.message });
    }
  }
  return issues;
}

function repeatableCapIssues(
  form: FormSchema,
  answers: Answers,
): OperatorIssue[] {
  const issues: OperatorIssue[] = [];
  for (const group of form.groups) {
    if (!group.repeatable) {
      continue;
    }
    const value = answers[group.id];
    if (Array.isArray(value) && value.length > REPEATABLE_MAX_ROWS) {
      issues.push({
        fieldId: group.id,
        message: `At most ${REPEATABLE_MAX_ROWS} rows`,
      });
    }
  }
  return issues;
}

function issuesFromZod(error: ZodError): OperatorIssue[] {
  return error.issues.map((issue) => ({
    fieldId: issue.path[0] !== undefined ? String(issue.path[0]) : undefined,
    message: issue.message,
  }));
}

export function collectOperatorIssues(
  form: FormSchema,
  input: unknown,
): OperatorIssue[] {
  const incoming = answersRecordSchema.safeParse(input ?? {});
  if (!incoming.success) {
    return issuesFromZod(incoming.error);
  }
  const capIssues = repeatableCapIssues(form, incoming.data);
  if (capIssues.length > 0) {
    return capIssues;
  }
  const preview = samplePreview(form, incoming.data);
  if (preview.error) {
    return [{ message: preview.error.message }];
  }
  const parsed = operatorAnswersSchema(form, preview).safeParse(preview.answers);
  if (!parsed.success) {
    return issuesFromZod(parsed.error);
  }
  return validationIssues(form, parsed.data);
}

export function parseOperatorAnswers(
  form: FormSchema,
  input: unknown,
): Answers {
  const incoming = answersRecordSchema.parse(input ?? {});
  const capIssues = repeatableCapIssues(form, incoming);
  if (capIssues.length > 0) {
    throw new OperatorAnswersError(capIssues);
  }
  const preview = samplePreview(form, incoming);
  if (preview.error) {
    throw preview.error;
  }
  const answers = operatorAnswersSchema(form, preview).parse(preview.answers);
  const issues = validationIssues(form, answers);
  if (issues.length > 0) {
    throw new OperatorAnswersError(issues);
  }
  return answers;
}
