"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  updateSelectOption,
} from "@/lib/document-types/form-schema";
import type { DocumentTypeVersionSnapshot, Field, FormSchema } from "@/types/document-type";

type Props = {
  documentTypeId: string;
  initialSnapshot: DocumentTypeVersionSnapshot;
};

export function StudioControlPanel({ documentTypeId, initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
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

  function patchForm(next: FormSchema | ((current: FormSchema) => FormSchema)) {
    setSnapshot((current) => ({
      ...current,
      formSchema:
        typeof next === "function" ? next(current.formSchema) : next,
    }));
  }

  return (
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
      {form.groups.map((group) => (
        <div className="flex flex-col gap-3 rounded-xl border p-3" key={group.id}>
          <div className="flex gap-2">
            <Input
              aria-label="Group title"
              onChange={(event) =>
                patchForm((current) =>
                  renameGroup(current, group.id, event.target.value || "Untitled group"),
                )
              }
              value={group.title}
            />
            <Button
              onClick={() => patchForm((current) => deleteGroup(current, group.id))}
              type="button"
              variant="outline"
            >
              Delete group
            </Button>
          </div>
          {group.fields.map((field, fieldIndex) => (
            <FieldEditor
              field={field}
              groupId={group.id}
              key={field.id}
              onChange={patchForm}
              canMoveDown={fieldIndex < group.fields.length - 1}
              canMoveUp={fieldIndex > 0}
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
  );
}

function FieldEditor({
  field,
  groupId,
  onChange,
  canMoveUp,
  canMoveDown,
}: {
  field: Field;
  groupId: string;
  onChange: (next: (current: FormSchema) => FormSchema) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
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
      {field.type === "select"
        ? field.options.map((option, optionIndex) => (
            <div className="flex gap-2" key={`${field.id}-${optionIndex}`}>
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
