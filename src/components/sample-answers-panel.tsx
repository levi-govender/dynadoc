"use client";

import { Button } from "@/components/ui/button";
import type { Answers } from "@/lib/expr/evaluate";
import { REPEATABLE_MAX_ROWS } from "@/lib/document-types/repeatable";
import type { Field } from "@/types/document-type";

type GroupView = {
  id: string;
  title: string;
  repeatable?: boolean;
  fields: Field[];
};

type Props = {
  groups: GroupView[];
  answers: Answers;
  onChange: (next: Answers) => void;
  error: string | null;
};

export function SampleAnswersPanel({
  groups,
  answers,
  onChange,
  error,
}: Props) {
  function setField(fieldId: string, value: unknown) {
    const next = { ...answers };
    if (value === undefined || value === "") {
      delete next[fieldId];
    } else {
      next[fieldId] = value;
    }
    onChange(next);
  }

  function setRowField(
    groupId: string,
    index: number,
    fieldId: string,
    value: unknown,
  ) {
    const rows = Array.isArray(answers[groupId])
      ? [...(answers[groupId] as Array<Record<string, unknown>>)]
      : [];
    const row = { ...(rows[index] ?? {}) };
    if (value === undefined || value === "") {
      delete row[fieldId];
    } else {
      row[fieldId] = value;
    }
    rows[index] = row;
    onChange({ ...answers, [groupId]: rows });
  }

  function addRow(groupId: string) {
    const rows = Array.isArray(answers[groupId])
      ? [...(answers[groupId] as Array<Record<string, unknown>>)]
      : [];
    if (rows.length >= REPEATABLE_MAX_ROWS) {
      return;
    }
    rows.push({});
    onChange({ ...answers, [groupId]: rows });
  }

  function removeRow(groupId: string, index: number) {
    const rows = Array.isArray(answers[groupId])
      ? [...(answers[groupId] as Array<Record<string, unknown>>)]
      : [];
    rows.splice(index, 1);
    onChange({ ...answers, [groupId]: rows });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Sample answers</h2>
      <p className="text-xs text-muted-foreground">
        Hidden groups unmount here. Switching a choice drops stale answers.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {groups.map((group) => (
        <fieldset className="flex flex-col gap-3" key={group.id}>
          <legend className="text-sm font-medium">{group.title}</legend>
          {group.repeatable ? (
            <>
              {(Array.isArray(answers[group.id])
                ? (answers[group.id] as Array<Record<string, unknown>>)
                : []
              ).map((row, index) => (
                <div className="flex flex-col gap-2 rounded-md border p-2" key={index}>
                  {group.fields.map((field) => (
                    <label className="flex flex-col gap-1 text-sm" key={field.id}>
                      <span>{field.label}</span>
                      <SampleInput
                        field={field}
                        onChange={(value) =>
                          setRowField(group.id, index, field.id, value)
                        }
                        value={row[field.id]}
                      />
                    </label>
                  ))}
                  <Button
                    onClick={() => removeRow(group.id, index)}
                    size="xs"
                    type="button"
                    variant="outline"
                  >
                    Remove row
                  </Button>
                </div>
              ))}
              <Button
                disabled={
                  (Array.isArray(answers[group.id])
                    ? answers[group.id].length
                    : 0) >= REPEATABLE_MAX_ROWS
                }
                onClick={() => addRow(group.id)}
                size="xs"
                type="button"
                variant="secondary"
              >
                Add row
              </Button>
            </>
          ) : (
            group.fields.map((field) => (
              <label className="flex flex-col gap-1 text-sm" key={field.id}>
                <span>
                  {field.label}
                  <span className="text-muted-foreground"> ({group.title})</span>
                </span>
                <SampleInput
                  field={field}
                  onChange={(value) => setField(field.id, value)}
                  value={answers[field.id]}
                />
              </label>
            ))
          )}
        </fieldset>
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
