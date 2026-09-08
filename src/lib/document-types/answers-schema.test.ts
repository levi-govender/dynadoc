import assert from "node:assert/strict";
import test from "node:test";
import { ZodError } from "zod";
import { parseOperatorAnswers } from "./answers-schema";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";
import fixture from "@/types/fixtures/employment-contract.json";

const form = parseDocumentTypeVersionSnapshot(fixture).formSchema;

test("drops hidden-group answers before Zod validation", () => {
  const answers = parseOperatorAnswers(form, {
    employmentType: "permanent",
    jobTitle: "Engineer",
    startDate: "2026-04-01",
    noticeWeeks: 4,
    endDate: "2027-03-31",
  });
  assert.equal(answers.endDate, undefined);
  assert.equal(answers.noticeWeeks, 4);
});

test("hidden required fields do not fail validation", () => {
  const answers = parseOperatorAnswers(form, {
    employmentType: "contractor",
    jobTitle: "Engineer",
    startDate: "2026-04-01",
  });
  assert.equal(answers.noticeWeeks, undefined);
  assert.equal(answers.endDate, undefined);
});

test("missing visible required field fails Zod", () => {
  assert.throws(
    () =>
      parseOperatorAnswers(form, {
        employmentType: "permanent",
        jobTitle: "Engineer",
        startDate: "2026-04-01",
      }),
    ZodError,
  );
});
