"use client";

import { AnswerFieldInput } from "@/components/answer-field-input";
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
  imageFieldIds?: Set<string>;
};

export function SampleAnswersPanel({
  groups,
  answers,
  onChange,
  error,
  imageFieldIds,
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
                <div
                  className="flex flex-col gap-2 rounded-md border p-2"
                  key={index}
                >
                  {group.fields.map((field) => (
                    <label
                      className="flex flex-col gap-1 text-sm"
                      key={field.id}
                    >
                      <span>{field.label}</span>
                      <AnswerFieldInput
                        field={field}
                        image={imageFieldIds?.has(field.id)}
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
                  <span className="text-muted-foreground">
                    {" "}
                    ({group.title})
                  </span>
                </span>
                <AnswerFieldInput
                  field={field}
                  image={imageFieldIds?.has(field.id)}
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
