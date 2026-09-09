"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VisibleWhenEditor } from "@/components/visible-when-editor";
import { cn } from "@/lib/utils";
import type { ActivationOverlapWarning } from "@/lib/document-types/branching";
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
  setGroupRepeatable,
  setGroupVisibleWhen,
  updateSelectOption,
} from "@/lib/document-types/form-schema";
import type { Field, FormSchema } from "@/types/document-type";

type Props = {
  form: FormSchema;
  patchForm: (next: FormSchema | ((current: FormSchema) => FormSchema)) => void;
  selectedFieldId: string | null;
  onSelectField: (fieldId: string) => void;
  overlapWarnings: ActivationOverlapWarning[];
  status: "idle" | "saving" | "saved" | "error";
  error: string | null;
};

export function StudioControlPanel({
  form,
  patchForm,
  selectedFieldId,
  onSelectField,
  overlapWarnings,
  status,
  error,
}: Props) {
  return (
    <section className="flex min-h-0 flex-col overflow-y-auto border-b bg-background xl:border-r xl:border-b-0">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background px-4 py-3">
        <h2 className="text-sm font-medium">Fields</h2>
        <p className="text-xs text-muted-foreground">
          {status === "saving"
            ? "Saving…"
            : status === "saved"
              ? "Saved"
              : status === "error"
                ? "Save failed"
                : "Autosave"}
        </p>
      </div>
      <div className="flex flex-col gap-4 p-4">
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
            <label className="flex items-center gap-2 text-xs">
              <input
                checked={group.repeatable === true}
                onChange={(event) =>
                  patchForm((current) =>
                    setGroupRepeatable(
                      current,
                      group.id,
                      event.target.checked,
                    ),
                  )
                }
                type="checkbox"
              />
              Repeatable (schedule items, extra parties)
            </label>
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
                onSelect={() => onSelectField(field.id)}
                selected={selectedFieldId === field.id}
              />
            ))}
            <div className="flex flex-wrap gap-1">
              {FIELD_TYPES.map((type) => (
                <Button
                  key={type}
                  onClick={() =>
                    patchForm((current) => addField(current, group.id, type))
                  }
                  size="xs"
                  type="button"
                  variant="outline"
                >
                  {type}
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
      </div>
    </section>
  );
}

function FieldEditor({
  field,
  form,
  groupId,
  onChange,
  onSelect,
  selected,
  canMoveUp,
  canMoveDown,
}: {
  field: Field;
  form: FormSchema;
  groupId: string;
  onChange: (next: (current: FormSchema) => FormSchema) => void;
  onSelect: () => void;
  selected: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const otherGroups = form.groups.filter((group) => group.id !== groupId);
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-2",
        selected && "border-amber-500 bg-amber-50/60",
      )}
    >
      <div className="flex flex-wrap gap-1">
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
          size="xs"
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
          size="xs"
          type="button"
          variant="ghost"
        >
          Down
        </Button>
        <Button
          onClick={() =>
            onChange((current) => deleteField(current, groupId, field.id))
          }
          size="xs"
          type="button"
          variant="outline"
        >
          Delete
        </Button>
        <Button
          onClick={onSelect}
          size="xs"
          type="button"
          variant={selected ? "secondary" : "ghost"}
        >
          {selected ? "Linked" : "Link"}
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
