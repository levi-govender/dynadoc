import assert from "node:assert/strict";
import test from "node:test";
import fixture from "@/types/fixtures/employment-contract.json";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";
import { resolveThemeSignatures, signatureImageFieldIds } from "./signatures";

const snapshot = parseDocumentTypeVersionSnapshot(fixture);
const pngData =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("two-party theme shows employee and employer signature slots", () => {
  const slots = resolveThemeSignatures(snapshot.styleTheme, {
    employeeName: "Alex Rivera",
    employerName: "Acme Ltd",
  });
  assert.equal(slots.length, 2);
  assert.equal(slots[0]?.partyLabel, "Employee");
  assert.equal(slots[0]?.partyName, "Alex Rivera");
  assert.equal(slots[1]?.partyLabel, "Employer");
  assert.equal(slots[1]?.partyName, "Acme Ltd");
});

test("signature image from answers is passed through", () => {
  const slots = resolveThemeSignatures(snapshot.styleTheme, {
    employeeSignatureImage: pngData,
  });
  assert.equal(slots[0]?.imageSrc, pngData);
  assert.equal(slots[1]?.imageSrc, null);
});

test("theme lists fields used as signature images", () => {
  assert.ok(
    signatureImageFieldIds(snapshot.styleTheme).has("employeeSignatureImage"),
  );
});
