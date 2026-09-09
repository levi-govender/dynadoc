import assert from "node:assert/strict";
import test from "node:test";
import type { IngestClassification } from "./classify";
import { applyIngestGates } from "./gates";

function classified(
  documentType: string,
  extras?: Partial<IngestClassification>,
): IngestClassification {
  return {
    category: "contract",
    documentType,
    confidence: 0.9,
    rationale: "test",
    holdout: false,
    inFamily: true,
    source: "heuristic",
    ...extras,
  };
}

test("NDA in an employment single-type job is held out; employment continues to clustering", () => {
  const gated = applyIngestGates({
    mode: "single_type",
    files: [
      {
        id: "emp",
        filename: "offer.pdf",
        error: null,
        classification: classified("employment"),
      },
      {
        id: "emp-2",
        filename: "handbook.pdf",
        error: null,
        classification: classified("employment"),
      },
      {
        id: "nda",
        filename: "nda.pdf",
        error: null,
        classification: classified("nda"),
      },
    ],
  });
  const nda = gated.files.find((file) => file.id === "nda")?.classification;
  const emp = gated.files.find((file) => file.id === "emp")?.classification;
  assert.equal(nda?.holdout, true);
  assert.equal(nda?.clusterEligible, false);
  assert.equal(nda?.gateReason, "type_mismatch");
  assert.equal(emp?.clusterEligible, true);
  assert.equal(emp?.holdout, false);
  assert.ok(gated.holdouts.some((row) => row.fileId === "nda"));
});

test("family gate holds out unrelated lease + employment", () => {
  const gated = applyIngestGates({
    mode: "decompose",
    files: [
      {
        id: "lease",
        filename: "lease.pdf",
        error: null,
        classification: classified("lease"),
      },
      {
        id: "emp",
        filename: "offer.pdf",
        error: null,
        classification: classified("employment"),
      },
    ],
  });
  assert.equal(
    gated.files.every((file) => file.classification?.clusterEligible === false),
    true,
  );
  assert.equal(
    gated.files.every(
      (file) => file.classification?.gateReason === "unrelated_family_types",
    ),
    true,
  );
});

test("decompose keeps related NDA + employment together for clustering", () => {
  const gated = applyIngestGates({
    mode: "decompose",
    files: [
      {
        id: "nda",
        filename: "nda.pdf",
        error: null,
        classification: classified("nda"),
      },
      {
        id: "emp",
        filename: "offer.pdf",
        error: null,
        classification: classified("employment"),
      },
    ],
  });
  assert.equal(
    gated.files.every((file) => file.classification?.clusterEligible === true),
    true,
  );
  assert.equal(gated.holdouts.length, 0);
});
