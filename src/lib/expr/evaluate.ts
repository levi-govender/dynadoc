import type { Expr } from "@/types/document-type";

export type Answers = Record<string, unknown>;

export class UnknownOperatorError extends Error {
  readonly operator: string;

  constructor(operator: string) {
    super(`Unknown expression operator: ${operator}`);
    this.name = "UnknownOperatorError";
    this.operator = operator;
  }
}

export class InvalidExprError extends Error {
  constructor(message = "Invalid expression") {
    super(message);
    this.name = "InvalidExprError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Flat keys win; otherwise walk dotted paths (`party.name`). Repeatable overlays use `group[].field`. */
export function readAnswer(answers: Answers, field: string) {
  if (Object.hasOwn(answers, field)) {
    const value = answers[field];
    return {
      missing: value === undefined,
      value,
    };
  }

  const parts = field.split(".");
  if (parts.length < 2) {
    return { missing: true, value: undefined };
  }

  let current: unknown = answers;
  for (const part of parts) {
    if (!isRecord(current) || !Object.hasOwn(current, part)) {
      return { missing: true, value: undefined };
    }
    current = current[part];
  }
  return { missing: current === undefined, value: current };
}

function valuesEqual(
  left: unknown,
  right: string | number | boolean | null,
) {
  return Object.is(left, right);
}

function evaluateKnown(expr: Expr, answers: Answers): boolean {
  switch (expr.op) {
    case "eq": {
      const { missing, value } = readAnswer(answers, expr.field);
      if (missing) {
        return false;
      }
      return valuesEqual(value, expr.value);
    }
    case "exists": {
      const { missing, value } = readAnswer(answers, expr.field);
      return !missing && value !== null;
    }
    case "in": {
      const { missing, value } = readAnswer(answers, expr.field);
      if (missing) {
        return false;
      }
      return expr.values.some((candidate) => valuesEqual(value, candidate));
    }
    case "not":
      return !evaluate(expr.expr, answers);
    case "and":
      if (expr.exprs.length < 1) {
        throw new InvalidExprError("and requires at least one expression");
      }
      return expr.exprs.every((inner) => evaluate(inner, answers));
    case "or":
      if (expr.exprs.length < 1) {
        throw new InvalidExprError("or requires at least one expression");
      }
      return expr.exprs.some((inner) => evaluate(inner, answers));
    default: {
      const operator = (expr as { op?: unknown }).op;
      throw new UnknownOperatorError(
        typeof operator === "string" ? operator : "unknown",
      );
    }
  }
}

/** Pure boolean evaluator. No I/O, no JavaScript eval. */
export function evaluate(expr: unknown, answers: Answers): boolean {
  if (!isRecord(expr) || typeof expr.op !== "string") {
    throw new InvalidExprError();
  }

  switch (expr.op) {
    case "eq":
    case "exists":
    case "in":
    case "not":
    case "and":
    case "or":
      return evaluateKnown(expr as Expr, answers);
    default:
      throw new UnknownOperatorError(expr.op);
  }
}
