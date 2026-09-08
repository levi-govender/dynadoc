"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SampleAnswersPanel } from "@/components/sample-answers-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VisibleWhenEditor } from "@/components/visible-when-editor";
import {
  overlappingActivationWarnings,
  samplePreview,
} from "@/lib/document-types/branching";
import {
  FIELD_TYPES,
  addField,
  addGroup,
  addSelectOption,
  deleteField,
  deleteGroup,
  deleteSelectOption,
  moveField,
  renameGroup,
  setFieldLabel,
  setFieldRequired,
  setFieldVisibleWhen,
  setGroupVisibleWhen,
  updateSelectOption,
} from "@/lib/document-types/form-schema";
import type { Answers } from "@/lib/expr/evaluate";
import type {
  DocumentTypeVersionSnapshot,
  Field,
  FormSchema,
} from "@/types/document-type";

type Props = {
  documentTypeId: string;
  initialSnapshot: DocumentTypeVersionSnapshot;
};

export function StudioControlPanel({ documentTypeId, initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [sampleAnswers, setSampleAnswers] = useState<Answers>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const skipFirst = useRef(true);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      void (async () => {
        setStatus("saving");
        const response = await fetch(
          `/api/document-types/${documentTypeId}/draft`,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(snapshot),
          },
        );
        if (!response.ok) {
          const payload: unknown = await response.json().catch(() => null);
          const message =
            payload &&
            typeof payload === "object" &&
            "error" in payload &&
            typeof payload.error === "string"
              ? payload.error
              : "Could not save draft";
          setError(message);
          setStatus("error");
          return;
        }
        setError(null);
        setStatus("saved");
      })();
    }, 400);
    return () => window.clearTimeout(handle);
  }, [documentTypeId, snapshot]);

  const form = snapshot.formSchema;
  const overlapWarnings = overlappingActivationWarnings(form);
  const preview = useMemo(
    () => samplePreview(form, sampleAnswers),
    [form, sampleAnswers],
  );

  function patchForm(next: FormSchema | ((current: FormSchema) => FormSchema)) {
    const formSchema = typeof next === "function" ? next(form) : next;
    setSnapshot((current) => ({ ...current, formSchema }));
    setSampleAnswers((previous) => {
      const stripped = samplePreview(formSchema, previous).answers;
      return JSON.stringify(stripped) === JSON.stringify(previous)
        ? previous
        : stripped;
    });
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <section className="flex max-w-xl flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Control panel</h2>
          <p className="text-xs text-muted-foreground">
            {status === "saving"
              ? "Saving…"
              : status === "saved"
                ? "Saved"
                : status === "error"
                  ? "Save failed"
                  : "Edits save automatically"}
          </p>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {overlapWarnings.map((warning) => (
          <p className="text-sm text-destructive" key={`${warning.fieldId}-${warning.optionA}`}>
            Options “{warning.optionA}” and “{warning.optionB}” on {warning.fieldLabel}{" "}
            both activate {warning.groupIds.join(", ")}.
          </p>
        ))}
        {form.groups.map((group) => (
          <div className="flex flex-col gap-3 rounded-xl border p-3" key={group.id}>
            <div className="flex gap-2">
              <Input
                aria-label="Group title"
                onChange={(event) =>
                  patchForm((current) =>
                    renameGroup(
                      current,
                      group.id,
                      event.target.value || "Untitled group",
                    ),
                  )
                }
                value={group.title}
              />
              <Button
                onClick={() =>
                  patchForm((current) => deleteGroup(current, group.id))
                }
                type="button"
                variant="outline"
              >
                Delete group
              </Button>
            </div>
            <VisibleWhenEditor
              form={form}
              onChange={(expr) =>
                patchForm((current) =>
                  setGroupVisibleWhen(current, group.id, expr),
                )
              }
              value={group.visibleWhen}
            />
            {group.fields.map((field, fieldIndex) => (
              <FieldEditor
                canMoveDown={fieldIndex < group.fields.length - 1}
                canMoveUp={fieldIndex > 0}
                field={field}
                form={form}
                groupId={group.id}
                key={field.id}
                onChange={patchForm}
              />
            ))}
            <div className="flex flex-wrap gap-2">
              {FIELD_TYPES.map((type) => (
                <Button
                  key={type}
                  onClick={() =>
                    patchForm((current) => addField(current, group.id, type))
                  }
                  type="button"
                  variant="outline"
                >
                  Add {type}
                </Button>
              ))}
            </div>
          </div>
        ))}
        <Button
          onClick={() => patchForm((current) => addGroup(current))}
          type="button"
          variant="secondary"
        >
          Add group
        </Button>
      </section>
      <SampleAnswersPanel
        answers={preview.answers}
        error={preview.error?.message ?? null}
        fields={preview.fields.map((entry) => ({
          field: entry.field,
          groupTitle: entry.group.title,
        }))}
        onChange={(fieldId, value) => {
          const next = { ...sampleAnswers };
          if (value === undefined || value === "") {
            delete next[fieldId];
          } else {
            next[fieldId] = value;
          }
          setSampleAnswers(samplePreview(form, next).answers);
        }}
      />
    </div>
  );
}

function FieldEditor({
  field,
  form,
  groupId,
  onChange,
  canMoveUp,
  canMoveDown,
}: {
  field: Field;
  form: FormSchema;
  groupId: string;
  onChange: (next: (current: FormSchema) => FormSchema) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const otherGroups = form.groups.filter((group) => group.id !== groupId);
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-2">
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="Field label"
          onChange={(event) =>
            onChange((current) =>
              setFieldLabel(
                current,
                groupId,
                field.id,
                event.target.value || "Untitled field",
              ),
            )
          }
          value={field.label}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={Boolean(field.required)}
            onChange={(event) =>
              onChange((current) =>
                setFieldRequired(
                  current,
                  groupId,
                  field.id,
                  event.target.checked,
                ),
              )
            }
            type="checkbox"
          />
          Required
        </label>
        <Button
          disabled={!canMoveUp}
          onClick={() =>
            onChange((current) => moveField(current, groupId, field.id, -1))
          }
          type="button"
          variant="ghost"
        >
          Up
        </Button>
        <Button
          disabled={!canMoveDown}
          onClick={() =>
            onChange((current) => moveField(current, groupId, field.id, 1))
          }
          type="button"
          variant="ghost"
        >
          Down
        </Button>
        <Button
          onClick={() =>
            onChange((current) => deleteField(current, groupId, field.id))
          }
          type="button"
          variant="outline"
        >
          Delete
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{field.type}</p>
      <VisibleWhenEditor
        form={form}
        onChange={(expr) =>
          onChange((current) =>
            setFieldVisibleWhen(current, groupId, field.id, expr),
          )
        }
        value={field.visibleWhen}
      />
      {field.type === "select"
        ? field.options.map((option, optionIndex) => (
            <div className="flex flex-col gap-2" key={`${field.id}-${optionIndex}`}>
              <div className="flex gap-2">
                <Input
                  aria-label="Option value"
                  onChange={(event) =>
                    onChange((current) =>
                      updateSelectOption(current, groupId, field.id, optionIndex, {
                        value: event.target.value || `option-${optionIndex + 1}`,
                      }),
                    )
                  }
                  value={option.value}
                />
                <Input
                  aria-label="Option label"
                  onChange={(event) =>
                    onChange((current) =>
                      updateSelectOption(current, groupId, field.id, optionIndex, {
                        label: event.target.value || `Option ${optionIndex + 1}`,
                      }),
                    )
                  }
                  value={option.label}
                />
                <Button
                  onClick={() =>
                    onChange((current) =>
                      deleteSelectOption(current, groupId, field.id, optionIndex),
                    )
                  }
                  type="button"
                  variant="ghost"
                >
                  Remove
                </Button>
              </div>
              {otherGroups.length > 0 ? (
                <div className="flex flex-wrap gap-2 pl-1 text-xs">
                  <span className="text-muted-foreground">Activates</span>
                  {otherGroups.map((target) => {
                    const checked = (option.activatesGroupIds ?? []).includes(
                      target.id,
                    );
                    return (
                      <label className="flex items-center gap-1" key={target.id}>
                        <input
                          checked={checked}
                          onChange={(event) => {
                            const currentIds = option.activatesGroupIds ?? [];
                            const activatesGroupIds = event.target.checked
                              ? [...currentIds, target.id]
                              : currentIds.filter((id) => id !== target.id);
                            onChange((current) =>
                              updateSelectOption(
                                current,
                                groupId,
                                field.id,
                                optionIndex,
                                { activatesGroupIds },
                              ),
                            );
                          }}
                          type="checkbox"
                        />
                        {target.title}
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))
        : null}
      {field.type === "select" ? (
        <Button
          onClick={() =>
            onChange((current) => addSelectOption(current, groupId, field.id))
          }
          type="button"
          variant="outline"
        >
          Add option
        </Button>
      ) : null}
    </div>
  );
}
