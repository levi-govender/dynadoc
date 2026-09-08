import type { Expr } from "@/types/document-type";

export type ExprKind = "always" | Expr["op"];

const KINDS: ExprKind[] = [
  "always",
  "eq",
  "in",
  "exists",
  "not",
  "and",
  "or",
];

export const EXPR_KINDS = KINDS;

export function defaultEq(fieldId: string): Expr {
  return { op: "eq", field: fieldId, value: "" };
}

function fieldOf(expr: Expr | undefined, fallback: string): string {
  if (!expr) {
    return fallback;
  }
  if (expr.op === "eq" || expr.op === "in" || expr.op === "exists") {
    return expr.field;
  }
  if (expr.op === "not") {
    return fieldOf(expr.expr, fallback);
  }
  return fieldOf(expr.exprs[0], fallback);
}

export function exprKind(expr: Expr | undefined): ExprKind {
  return expr?.op ?? "always";
}

export function setExprKind(
  expr: Expr | undefined,
  kind: ExprKind,
  fallbackField: string,
): Expr | undefined {
  if (kind === "always") {
    return undefined;
  }
  const field = fieldOf(expr, fallbackField);
  if (kind === "eq") {
    if (expr?.op === "eq") {
      return expr;
    }
    const value =
      expr?.op === "in" ? String(expr.values[0] ?? "") : "";
    return { op: "eq", field, value };
  }
  if (kind === "in") {
    if (expr?.op === "in") {
      return expr;
    }
    const values =
      expr?.op === "eq" && expr.value != null ? [String(expr.value)] : [];
    return { op: "in", field, values };
  }
  if (kind === "exists") {
    return { op: "exists", field };
  }
  const inner = expr && expr.op !== "not" && expr.op !== "and" && expr.op !== "or"
    ? expr
    : defaultEq(field);
  if (kind === "not") {
    return { op: "not", expr: inner };
  }
  const first =
    expr?.op === kind ? expr.exprs : [inner];
  const exprs = first.length >= 2 ? first : [...first, defaultEq(field)];
  return { op: kind, exprs };
}

export function addExprBranch(expr: Expr, fallbackField: string): Expr {
  if (expr.op !== "and" && expr.op !== "or") {
    return expr;
  }
  return { ...expr, exprs: [...expr.exprs, defaultEq(fallbackField)] };
}

export function replaceExprBranch(
  expr: Expr,
  index: number,
  next: Expr | undefined,
  fallbackField: string,
): Expr {
  if (expr.op !== "and" && expr.op !== "or") {
    return expr;
  }
  const exprs = expr.exprs.map((child, childIndex) =>
    childIndex === index ? (next ?? defaultEq(fallbackField)) : child,
  );
  return { ...expr, exprs };
}

export function removeExprBranch(expr: Expr, index: number): Expr | undefined {
  if (expr.op !== "and" && expr.op !== "or") {
    return expr;
  }
  const exprs = expr.exprs.filter((_, childIndex) => childIndex !== index);
  if (exprs.length === 0) {
    return undefined;
  }
  if (exprs.length === 1) {
    return exprs[0];
  }
  return { ...expr, exprs };
}
