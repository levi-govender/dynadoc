import { evaluate, type Answers } from "@/lib/expr/evaluate";
import {
  GroupActivationCycleError,
  activeFieldGroups,
  stripInactiveAnswers,
} from "@/lib/resolver/resolve";
import type { Field, FieldGroup, FormSchema } from "@/types/document-type";

export type ActivationOverlapWarning = {
  fieldId: string;
  fieldLabel: string;
  optionA: string;
  optionB: string;
  groupIds: string[];
};

export function overlappingActivationWarnings(
  form: FormSchema,
): ActivationOverlapWarning[] {
  const titles = new Map(form.groups.map((group) => [group.id, group.title]));
  const warnings: ActivationOverlapWarning[] = [];

  for (const group of form.groups) {
    for (const field of group.fields) {
      if (field.type !== "select") {
        continue;
      }
      for (let i = 0; i < field.options.length; i += 1) {
        for (let j = i + 1; j < field.options.length; j += 1) {
          const a = field.options[i];
          const b = field.options[j];
          if (!a || !b) {
            continue;
          }
          const left = new Set(a.activatesGroupIds ?? []);
          const overlap = (b.activatesGroupIds ?? []).filter((id) =>
            left.has(id),
          );
          if (overlap.length === 0) {
            continue;
          }
          warnings.push({
            fieldId: field.id,
            fieldLabel: field.label,
            optionA: a.label,
            optionB: b.label,
            groupIds: overlap.map((id) => titles.get(id) ?? id),
          });
        }
      }
    }
  }
  return warnings;
}

export function samplePreview(form: FormSchema, answers: Answers) {
  try {
    const activeGroups = activeFieldGroups(form, answers);
    const stripped = stripInactiveAnswers(form, answers, activeGroups);
    const fields: Array<{ group: FieldGroup; field: Field }> = [];
    for (const group of form.groups) {
      if (!activeGroups.has(group.id)) {
        continue;
      }
      for (const field of group.fields) {
        if (field.visibleWhen && !evaluate(field.visibleWhen, answers)) {
          continue;
        }
        fields.push({ group, field });
      }
    }
    return {
      answers: stripped,
      fields,
      activeGroups,
      error: null as GroupActivationCycleError | null,
    };
  } catch (error) {
    if (error instanceof GroupActivationCycleError) {
      return {
        answers: {} as Answers,
        fields: [],
        activeGroups: new Set<string>(),
        error,
      };
    }
    throw error;
  }
}
