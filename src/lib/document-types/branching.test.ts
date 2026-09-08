import assert from "node:assert/strict";
import test from "node:test";
import {
  overlappingActivationWarnings,
  samplePreview,
} from "./branching";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";
import fixture from "@/types/fixtures/employment-contract.json";

const form = parseDocumentTypeVersionSnapshot(fixture).formSchema;

test("Fixed-term sample preview shows end date and hides permanent fields", () => {
  const preview = samplePreview(form, {
    employmentType: "fixed-term",
    jobTitle: "Engineer",
    startDate: "2026-04-01",
    noticeWeeks: 4,
    endDate: "2027-03-31",
  });
  const ids = preview.fields.map((entry) => entry.field.id);
  assert.ok(ids.includes("endDate"));
  assert.equal(ids.includes("noticeWeeks"), false);
  assert.equal(preview.answers.noticeWeeks, undefined);
  assert.equal(preview.answers.endDate, "2027-03-31");
  assert.ok(preview.activeGroups.has("fixedTerm"));
  assert.equal(preview.activeGroups.has("permanentTerms"), false);
});

test("switching back to permanent drops stale end date from preview answers", () => {
  const afterFixed = samplePreview(form, {
    employmentType: "fixed-term",
    endDate: "2027-03-31",
    noticeWeeks: 4,
  });
  const afterPermanent = samplePreview(form, {
    ...afterFixed.answers,
    employmentType: "permanent",
    noticeWeeks: 4,
  });
  assert.equal(afterPermanent.answers.endDate, undefined);
  assert.equal(afterPermanent.answers.noticeWeeks, 4);
  const ids = afterPermanent.fields.map((entry) => entry.field.id);
  assert.ok(ids.includes("noticeWeeks"));
  assert.equal(ids.includes("endDate"), false);
});

test("overlapping activatesGroupIds on sibling options warns", () => {
  const warnings = overlappingActivationWarnings({
    schemaVersion: 1,
    groups: [
      {
        id: "root",
        title: "Root",
        fields: [
          {
            id: "kind",
            type: "select",
            label: "Kind",
            options: [
              {
                value: "a",
                label: "A",
                activatesGroupIds: ["shared"],
              },
              {
                value: "b",
                label: "B",
                activatesGroupIds: ["shared"],
              },
            ],
          },
        ],
      },
      { id: "shared", title: "Shared", fields: [] },
    ],
  });
  assert.equal(warnings.length, 1);
  assert.deepEqual(warnings[0]?.groupIds, ["Shared"]);
});
