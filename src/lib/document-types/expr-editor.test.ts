import assert from "node:assert/strict";
import test from "node:test";
import { evaluate } from "@/lib/expr/evaluate";
import {
  addExprBranch,
  removeExprBranch,
  setExprKind,
} from "./expr-editor";

test("setExprKind wraps an eq in and with a second branch", () => {
  const eq = { op: "eq" as const, field: "employmentType", value: "permanent" };
  const and = setExprKind(eq, "and", "jobTitle");
  assert.equal(and?.op, "and");
  if (and?.op !== "and") {
    return;
  }
  assert.equal(and.exprs.length, 2);
  assert.deepEqual(and.exprs[0], eq);
  assert.deepEqual(and.exprs[1], {
    op: "eq",
    field: "employmentType",
    value: "",
  });
});

test("nested and evaluates for permanent engineer", () => {
  const expr = {
    op: "and" as const,
    exprs: [
      { op: "eq" as const, field: "employmentType", value: "permanent" },
      { op: "eq" as const, field: "jobTitle", value: "Engineer" },
    ],
  };
  assert.equal(
    evaluate(expr, { employmentType: "permanent", jobTitle: "Engineer" }),
    true,
  );
  assert.equal(
    evaluate(expr, { employmentType: "contractor", jobTitle: "Engineer" }),
    false,
  );
});

test("addExprBranch and removeExprBranch keep a valid tree", () => {
  const or = addExprBranch(
    {
      op: "or",
      exprs: [
        { op: "eq", field: "employmentType", value: "permanent" },
        { op: "eq", field: "employmentType", value: "contractor" },
      ],
    },
    "jobTitle",
  );
  assert.equal(or.op, "or");
  if (or.op !== "or") {
    return;
  }
  assert.equal(or.exprs.length, 3);
  const unwrapped = removeExprBranch(
    {
      op: "and",
      exprs: [
        { op: "eq", field: "a", value: "1" },
        { op: "eq", field: "b", value: "2" },
      ],
    },
    1,
  );
  assert.deepEqual(unwrapped, { op: "eq", field: "a", value: "1" });
});
