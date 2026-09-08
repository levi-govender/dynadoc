import assert from "node:assert/strict";
import test from "node:test";
import fixture from "@/types/fixtures/employment-contract.json";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";
import { studioResolve } from "./structure-preview";

const snapshot = parseDocumentTypeVersionSnapshot(fixture);

test("toggling employment type rewrites the resolved block tree", () => {
  const fixedTerm = studioResolve(snapshot, {
    employmentType: "fixed-term",
    jobTitle: "Engineer",
    startDate: "2026-04-01",
    endDate: "2027-03-31",
  });
  const permanent = studioResolve(snapshot, {
    employmentType: "permanent",
    jobTitle: "Engineer",
    startDate: "2026-04-01",
    noticeWeeks: 4,
  });
  assert.equal(fixedTerm.ok, true);
  assert.equal(permanent.ok, true);
  if (!fixedTerm.ok || !permanent.ok) {
    return;
  }
  const fixedIds = fixedTerm.result.document.blocks.map((block) => block.id);
  const permanentIds = permanent.result.document.blocks.map((block) => block.id);
  assert.equal(fixedIds.includes("end"), true);
  assert.equal(fixedIds.includes("notice"), false);
  assert.equal(permanentIds.includes("notice"), true);
  assert.equal(permanentIds.includes("end"), false);
});

test("missing bindings surface resolver warnings", () => {
  const resolved = studioResolve(snapshot, {
    employmentType: "contractor",
    jobTitle: "Engineer",
  });
  assert.equal(resolved.ok, true);
  if (!resolved.ok) {
    return;
  }
  assert.ok(
    resolved.result.warnings.some(
      (warning) =>
        warning.field === "startDate" && warning.placeholder === "{{startDate}}",
    ),
  );
});
