import assert from "node:assert/strict";
import test from "node:test";
import { parseFillDraft, serializeFillDraft } from "./fill-draft";

test("parseFillDraft restores answers and step", () => {
  const raw = serializeFillDraft({
    answers: { employeeName: "Ada" },
    step: 2,
  });
  const parsed = parseFillDraft(raw);
  assert.equal(parsed?.step, 2);
  assert.equal(parsed?.answers.employeeName, "Ada");
});

test("parseFillDraft rejects junk", () => {
  assert.equal(parseFillDraft("nope"), null);
  assert.equal(parseFillDraft(null), null);
});
