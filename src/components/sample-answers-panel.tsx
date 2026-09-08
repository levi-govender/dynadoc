"use client";

import type { Answers } from "@/lib/expr/evaluate";
import type { Field } from "@/types/document-type";

type Props = {
  fields: Array<{ field: Field; groupTitle: string }>;
  answers: Answers;
  onChange: (fieldId: string, value: unknown) => void;
  error: string | null;
};

export function SampleAnswersPanel({
  fields,
  answers,
  onChange,
  error,
}: Props) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Sample answers</h2>
      <p className="text-xs text-muted-foreground">
        Hidden groups unmount here. Switching a choice drops stale answers.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {fields.map(({ field, groupTitle }) => (
        <label className="flex flex-col gap-1 text-sm" key={field.id}>
          <span>
            {field.label}
            <span className="text-muted-foreground"> ({groupTitle})</span>
          </span>
          <SampleInput
            field={field}
            onChange={(value) => onChange(field.id, value)}
            value={answers[field.id]}
          />
        </label>
      ))}
    </section>
  );
}

function SampleInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const text = value == null ? "" : String(value);
  if (field.type === "select") {
    return (
      <select
        className="h-8 rounded-md border bg-background px-2"
        onChange={(event) => onChange(event.target.value || undefined)}
        value={text}
      >
        <option value="">Choose…</option>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "boolean") {
    return (
      <input
        checked={value === true}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    );
  }
  if (field.type === "textarea") {
    return (
      <textarea
        className="min-h-16 rounded-md border bg-background px-2 py-1"
        onChange={(event) => onChange(event.target.value)}
        value={text}
      />
    );
  }
  const inputType =
    field.type === "number" ? "number" : field.type === "date" ? "date" : "text";
  return (
    <input
      className="h-8 rounded-md border bg-background px-2"
      onChange={(event) =>
        onChange(
          field.type === "number"
            ? event.target.value === ""
              ? undefined
              : Number(event.target.value)
            : event.target.value,
        )
      }
      type={inputType}
      value={text}
    />
  );
}
