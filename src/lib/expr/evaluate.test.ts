import assert from "node:assert/strict";
import test from "node:test";
import {
  InvalidExprError,
  UnknownOperatorError,
  evaluate,
} from "./evaluate";
import type { Expr } from "@/types/document-type";

const cases: Array<{
  name: string;
  expr: Expr;
  answers: Record<string, unknown>;
  expected: boolean;
}> = [
  {
    name: "eq matches a present string",
    expr: { op: "eq", field: "employmentType", value: "permanent" },
    answers: { employmentType: "permanent" },
    expected: true,
  },
  {
    name: "eq is false when the field is missing",
    expr: { op: "eq", field: "employmentType", value: "permanent" },
    answers: {},
    expected: false,
  },
  {
    name: "eq to null is false when the field is missing",
    expr: { op: "eq", field: "endDate", value: null },
    answers: {},
    expected: false,
  },
  {
    name: "eq to null is true when the field is present null",
    expr: { op: "eq", field: "endDate", value: null },
    answers: { endDate: null },
    expected: true,
  },
  {
    name: "exists is false when the key is missing",
    expr: { op: "exists", field: "endDate" },
    answers: {},
    expected: false,
  },
  {
    name: "exists is false for null",
    expr: { op: "exists", field: "endDate" },
    answers: { endDate: null },
    expected: false,
  },
  {
    name: "exists is true for a present value",
    expr: { op: "exists", field: "jobTitle" },
    answers: { jobTitle: "Engineer" },
    expected: true,
  },
  {
    name: "in matches one of the values",
    expr: { op: "in", field: "jobTitle", values: ["Engineer", "Manager"] },
    answers: { jobTitle: "Manager" },
    expected: true,
  },
  {
    name: "in is false when the field is missing",
    expr: { op: "in", field: "jobTitle", values: ["Engineer"] },
    answers: {},
    expected: false,
  },
  {
    name: "not inverts eq",
    expr: {
      op: "not",
      expr: { op: "eq", field: "employmentType", value: "contractor" },
    },
    answers: { employmentType: "permanent" },
    expected: true,
  },
  {
    name: "nested and/or: permanent engineer",
    expr: {
      op: "and",
      exprs: [
        { op: "eq", field: "employmentType", value: "permanent" },
        {
          op: "or",
          exprs: [
            { op: "eq", field: "jobTitle", value: "Engineer" },
            { op: "eq", field: "jobTitle", value: "Manager" },
          ],
        },
      ],
    },
    answers: { employmentType: "permanent", jobTitle: "Engineer" },
    expected: true,
  },
  {
    name: "nested and/or: contractor engineer fails the and",
    expr: {
      op: "and",
      exprs: [
        { op: "eq", field: "employmentType", value: "permanent" },
        {
          op: "or",
          exprs: [
            { op: "eq", field: "jobTitle", value: "Engineer" },
            { op: "eq", field: "jobTitle", value: "Manager" },
          ],
        },
      ],
    },
    answers: { employmentType: "contractor", jobTitle: "Engineer" },
    expected: false,
  },
  {
    name: "nested or of ands",
    expr: {
      op: "or",
      exprs: [
        {
          op: "and",
          exprs: [
            { op: "eq", field: "employmentType", value: "permanent" },
            { op: "exists", field: "probationMonths" },
          ],
        },
        { op: "eq", field: "employmentType", value: "contractor" },
      ],
    },
    answers: { employmentType: "contractor" },
    expected: true,
  },
];

for (const row of cases) {
  test(row.name, () => {
    assert.equal(evaluate(row.expr, row.answers), row.expected);
  });
}

test("unknown operator throws a typed error", () => {
  assert.throws(
    () =>
      evaluate(
        { op: "js", code: "employmentType === 'permanent'" },
        { employmentType: "permanent" },
      ),
    (error: unknown) =>
      error instanceof UnknownOperatorError &&
      error.operator === "js" &&
      error.name === "UnknownOperatorError",
  );
});

test("non-object expression throws InvalidExprError", () => {
  assert.throws(() => evaluate("employmentType == permanent", {}), InvalidExprError);
});

test("does not eval JavaScript strings", () => {
  assert.throws(
    () => evaluate({ op: "eval", code: "1 + 1" }, {}),
    UnknownOperatorError,
  );
  assert.equal(
    evaluate({ op: "eq", field: "n", value: 2 }, { n: 2 }),
    true,
  );
});
