"use client";

import { Button } from "@/components/ui/button";
import {
  EXPR_KINDS,
  addExprBranch,
  exprKind,
  removeExprBranch,
  replaceExprBranch,
  setExprKind,
} from "@/lib/document-types/expr-editor";
import type { Expr, FormSchema } from "@/types/document-type";

type FieldOption = { id: string; label: string };

type Props = {
  form: FormSchema;
  value: Expr | undefined;
  onChange: (expr: Expr | undefined) => void;
  label?: string;
};

const KIND_LABELS: Record<(typeof EXPR_KINDS)[number], string> = {
  always: "Always",
  eq: "equals",
  in: "in",
  exists: "exists",
  not: "not",
  and: "and",
  or: "or",
};

export function VisibleWhenEditor({
  form,
  value,
  onChange,
  label = "Visible when",
}: Props) {
  const fields = form.groups.flatMap((group) =>
    group.fields.map((field) => ({ id: field.id, label: field.label })),
  );
  const fallback = fields[0]?.id ?? "field";

  return (
    <div className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <ExprNode
        expr={value}
        fallbackField={fallback}
        fields={fields}
        onChange={onChange}
      />
    </div>
  );
}

function ExprNode({
  expr,
  fields,
  fallbackField,
  onChange,
}: {
  expr: Expr | undefined;
  fields: FieldOption[];
  fallbackField: string;
  onChange: (expr: Expr | undefined) => void;
}) {
  const kind = exprKind(expr);

  return (
    <div className="flex flex-col gap-1 rounded-md border border-dashed p-1.5">
      <select
        aria-label="Rule operator"
        className="h-7 w-fit rounded-md border bg-background px-1"
        onChange={(event) =>
          onChange(
            setExprKind(
              expr,
              event.target.value as (typeof EXPR_KINDS)[number],
              fallbackField,
            ),
          )
        }
        value={kind}
      >
        {EXPR_KINDS.map((entry) => (
          <option key={entry} value={entry}>
            {KIND_LABELS[entry]}
          </option>
        ))}
      </select>
      {kind === "eq" && expr?.op === "eq" ? (
        <div className="flex flex-wrap items-center gap-1">
          <FieldSelect
            fields={fields}
            onChange={(field) => onChange({ ...expr, field })}
            value={expr.field}
          />
          <input
            aria-label="Equals value"
            className="h-7 w-32 rounded-md border bg-background px-1"
            onChange={(event) =>
              onChange({ ...expr, value: event.target.value })
            }
            value={String(expr.value ?? "")}
          />
        </div>
      ) : null}
      {kind === "in" && expr?.op === "in" ? (
        <div className="flex flex-wrap items-center gap-1">
          <FieldSelect
            fields={fields}
            onChange={(field) => onChange({ ...expr, field })}
            value={expr.field}
          />
          <input
            aria-label="In values"
            className="h-7 min-w-40 flex-1 rounded-md border bg-background px-1"
            onChange={(event) =>
              onChange({
                ...expr,
                values: event.target.value
                  .split(",")
                  .map((part) => part.trim())
                  .filter(Boolean),
              })
            }
            placeholder="a, b, c"
            value={expr.values.map(String).join(", ")}
          />
        </div>
      ) : null}
      {kind === "exists" && expr?.op === "exists" ? (
        <FieldSelect
          fields={fields}
          onChange={(field) => onChange({ ...expr, field })}
          value={expr.field}
        />
      ) : null}
      {kind === "not" && expr?.op === "not" ? (
        <ExprNode
          expr={expr.expr}
          fallbackField={fallbackField}
          fields={fields}
          onChange={(next) =>
            onChange({
              op: "not",
              expr: next ?? { op: "eq", field: fallbackField, value: "" },
            })
          }
        />
      ) : null}
      {(kind === "and" || kind === "or") &&
      (expr?.op === "and" || expr?.op === "or") ? (
        <>
          {expr.exprs.map((child, index) => (
            <div className="flex gap-1" key={`${expr.op}-${index}`}>
              <div className="min-w-0 flex-1">
                <ExprNode
                  expr={child}
                  fallbackField={fallbackField}
                  fields={fields}
                  onChange={(next) =>
                    onChange(
                      replaceExprBranch(expr, index, next, fallbackField),
                    )
                  }
                />
              </div>
              <Button
                onClick={() => onChange(removeExprBranch(expr, index))}
                size="xs"
                type="button"
                variant="ghost"
              >
                ×
              </Button>
            </div>
          ))}
          <Button
            onClick={() => onChange(addExprBranch(expr, fallbackField))}
            size="xs"
            type="button"
            variant="outline"
          >
            Add {kind} condition
          </Button>
        </>
      ) : null}
    </div>
  );
}

function FieldSelect({
  fields,
  value,
  onChange,
}: {
  fields: FieldOption[];
  value: string;
  onChange: (field: string) => void;
}) {
  return (
    <select
      aria-label="Rule field"
      className="h-7 rounded-md border bg-background px-1"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {fields.length === 0 ? <option value={value}>{value}</option> : null}
      {fields.map((field) => (
        <option key={field.id} value={field.id}>
          {field.label}
        </option>
      ))}
    </select>
  );
}
