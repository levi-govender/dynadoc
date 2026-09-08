"use client";

import type { Expr, FormSchema } from "@/types/document-type";

type Props = {
  form: FormSchema;
  value: Expr | undefined;
  onChange: (expr: Expr | undefined) => void;
  label?: string;
};

function eqState(expr: Expr | undefined) {
  if (expr?.op === "eq") {
    return { field: expr.field, value: String(expr.value ?? "") };
  }
  return { field: "", value: "" };
}

export function VisibleWhenEditor({
  form,
  value,
  onChange,
  label = "Visible when",
}: Props) {
  const state = eqState(value);
  const fields = form.groups.flatMap((group) =>
    group.fields.map((field) => ({ id: field.id, label: field.label })),
  );

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select
        aria-label={`${label} field`}
        className="h-7 rounded-md border bg-background px-1"
        onChange={(event) => {
          const field = event.target.value;
          if (!field) {
            onChange(undefined);
            return;
          }
          onChange({ op: "eq", field, value: state.value });
        }}
        value={state.field}
      >
        <option value="">Always</option>
        {fields.map((field) => (
          <option key={field.id} value={field.id}>
            {field.label}
          </option>
        ))}
      </select>
      {state.field ? (
        <>
          <span>equals</span>
          <input
            aria-label={`${label} value`}
            className="h-7 w-32 rounded-md border bg-background px-1"
            onChange={(event) =>
              onChange({
                op: "eq",
                field: state.field,
                value: event.target.value,
              })
            }
            value={state.value}
          />
        </>
      ) : null}
    </div>
  );
}
