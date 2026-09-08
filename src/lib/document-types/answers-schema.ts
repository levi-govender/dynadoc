import { z } from "zod";
import { samplePreview } from "@/lib/document-types/branching";
import type { Answers } from "@/lib/expr/evaluate";
import type { Field, FormSchema } from "@/types/document-type";

const answersRecordSchema = z.record(z.string(), z.unknown());

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

export function parseOperatorAnswers(
  form: FormSchema,
  input: unknown,
): Answers {
  const incoming = answersRecordSchema.parse(input ?? {});
  const preview = samplePreview(form, incoming);
  if (preview.error) {
    throw preview.error;
  }
  const shape: Record<string, z.ZodType> = {};
  for (const { field } of preview.fields) {
    shape[field.id] = fieldValueSchema(field);
  }
  return z.object(shape).parse(preview.answers);
}
