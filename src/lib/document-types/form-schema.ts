import { listBindableFields } from "@/lib/document-types/repeatable";
import type {
  Expr,
  Field,
  FieldGroup,
  FormSchema,
} from "@/types/document-type";
import { formSchemaSchema } from "@/types/document-type";

export const FIELD_TYPES = [
  "text",
  "textarea",
  "select",
  "number",
  "date",
  "boolean",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Short text",
  textarea: "Long text",
  select: "Choice",
  number: "Number",
  date: "Date",
  boolean: "Yes / no",
};

function newId() {
  return crypto.randomUUID();
}

function mapGroup(
  form: FormSchema,
  groupId: string,
  update: (group: FieldGroup) => FieldGroup,
): FormSchema {
  return {
    ...form,
    groups: form.groups.map((group) =>
      group.id === groupId ? update(group) : group,
    ),
  };
}

export function createField(type: FieldType, label = "Untitled field"): Field {
  const id = newId();
  if (type === "select") {
    return {
      id,
      type,
      label,
      options: [{ value: "option-1", label: "Option 1" }],
    };
  }
  return { id, type, label };
}

export function addGroup(
  form: FormSchema,
  title = "Untitled group",
): FormSchema {
  return {
    ...form,
    groups: [...form.groups, { id: newId(), title, fields: [] }],
  };
}

export function renameGroup(
  form: FormSchema,
  groupId: string,
  title: string,
): FormSchema {
  return mapGroup(form, groupId, (group) => ({ ...group, title }));
}

export function deleteGroup(form: FormSchema, groupId: string): FormSchema {
  if (form.groups.length <= 1) {
    return form;
  }
  return {
    ...form,
    groups: form.groups.filter((group) => group.id !== groupId),
  };
}

export function addField(
  form: FormSchema,
  groupId: string,
  type: FieldType,
): FormSchema {
  const field = createField(type);
  return mapGroup(form, groupId, (group) => ({
    ...group,
    fields: [...group.fields, field],
  }));
}

export function updateField(
  form: FormSchema,
  groupId: string,
  fieldId: string,
  patch: (field: Field) => Field,
): FormSchema {
  return mapGroup(form, groupId, (group) => ({
    ...group,
    fields: group.fields.map((field) =>
      field.id === fieldId ? patch(field) : field,
    ),
  }));
}

export function setFieldLabel(
  form: FormSchema,
  groupId: string,
  fieldId: string,
  label: string,
): FormSchema {
  return updateField(form, groupId, fieldId, (field) => ({ ...field, label }));
}

export function setFieldRequired(
  form: FormSchema,
  groupId: string,
  fieldId: string,
  required: boolean,
): FormSchema {
  return updateField(form, groupId, fieldId, (field) => ({
    ...field,
    required: required ? true : undefined,
  }));
}

export function deleteField(
  form: FormSchema,
  groupId: string,
  fieldId: string,
): FormSchema {
  return mapGroup(form, groupId, (group) => ({
    ...group,
    fields: group.fields.filter((field) => field.id !== fieldId),
  }));
}

export function moveField(
  form: FormSchema,
  groupId: string,
  fieldId: string,
  direction: -1 | 1,
): FormSchema {
  return mapGroup(form, groupId, (group) => {
    const index = group.fields.findIndex((field) => field.id === fieldId);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= group.fields.length) {
      return group;
    }
    const fields = [...group.fields];
    const [moved] = fields.splice(index, 1);
    if (!moved) {
      return group;
    }
    fields.splice(next, 0, moved);
    return { ...group, fields };
  });
}

export function addSelectOption(
  form: FormSchema,
  groupId: string,
  fieldId: string,
): FormSchema {
  return updateField(form, groupId, fieldId, (field) => {
    if (field.type !== "select") {
      return field;
    }
    const n = field.options.length + 1;
    return {
      ...field,
      options: [
        ...field.options,
        { value: `option-${n}`, label: `Option ${n}` },
      ],
    };
  });
}

export function updateSelectOption(
  form: FormSchema,
  groupId: string,
  fieldId: string,
  optionIndex: number,
  patch: { value?: string; label?: string; activatesGroupIds?: string[] },
): FormSchema {
  return updateField(form, groupId, fieldId, (field) => {
    if (field.type !== "select") {
      return field;
    }
    return {
      ...field,
      options: field.options.map((option, index) =>
        index === optionIndex
          ? {
              ...option,
              value: patch.value ?? option.value,
              label: patch.label ?? option.label,
              activatesGroupIds:
                patch.activatesGroupIds ?? option.activatesGroupIds,
            }
          : option,
      ),
    };
  });
}

export function setGroupRepeatable(
  form: FormSchema,
  groupId: string,
  repeatable: boolean,
): FormSchema {
  return mapGroup(form, groupId, (group) => ({
    ...group,
    repeatable: repeatable ? true : undefined,
  }));
}

export function setGroupVisibleWhen(
  form: FormSchema,
  groupId: string,
  visibleWhen: Expr | undefined,
): FormSchema {
  return mapGroup(form, groupId, (group) => ({ ...group, visibleWhen }));
}

export function setFieldVisibleWhen(
  form: FormSchema,
  groupId: string,
  fieldId: string,
  visibleWhen: Expr | undefined,
): FormSchema {
  return updateField(form, groupId, fieldId, (field) => ({
    ...field,
    visibleWhen,
  }));
}

export function deleteSelectOption(
  form: FormSchema,
  groupId: string,
  fieldId: string,
  optionIndex: number,
): FormSchema {
  return updateField(form, groupId, fieldId, (field) => {
    if (field.type !== "select" || field.options.length <= 1) {
      return field;
    }
    return {
      ...field,
      options: field.options.filter((_, index) => index !== optionIndex),
    };
  });
}

export function parseFormSchema(input: unknown): FormSchema {
  return formSchemaSchema.parse(input);
}

export function listFormFields(form: FormSchema) {
  return listBindableFields(form).map((entry) => ({
    id: entry.id,
    label: entry.label,
    type: entry.type,
    options: entry.options,
  }));
}
