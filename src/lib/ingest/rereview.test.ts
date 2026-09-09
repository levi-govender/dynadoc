import assert from "node:assert/strict";
import test from "node:test";
import type { IngestClassification } from "./classify";
import { eligibleClusterFiles, proposeIngestClusters } from "./cluster";
import { applyRereviewAction } from "./rereview";

function labels(
  extras?: Partial<IngestClassification>,
): IngestClassification {
  return {
    category: "other",
    documentType: "invoice",
    confidence: 0.9,
    rationale: "invoice",
    holdout: true,
    inFamily: false,
    clusterEligible: false,
    needsAuthorAction: true,
    source: "heuristic",
    ...extras,
  };
}

test("hold-out file cannot enter clustering until an author action", () => {
  const holdout = {
    id: "inv",
    filename: "invoice.pdf",
    extractedText: "TAX INVOICE amount due",
    classification: labels(),
  };
  assert.equal(eligibleClusterFiles([holdout]).length, 0);
  assert.throws(() => proposeIngestClusters([holdout]));
  const confirmed = applyRereviewAction({
    classification: labels(),
    action: "confirm_and_continue",
    declaredCategory: "contract",
  });
  assert.equal(confirmed.holdout, false);
  assert.equal(confirmed.clusterEligible, true);
  assert.equal(confirmed.needsAuthorAction, false);
  const eligible = eligibleClusterFiles([
    { ...holdout, classification: confirmed },
  ]);
  assert.equal(eligible.length, 1);
});

test("rereview recategorize reclassifies after a label change", () => {
  const next = applyRereviewAction({
    classification: labels(),
    action: "recategorize",
    declaredCategory: "contract",
    labels: { category: "contract", documentType: "employment" },
  });
  assert.equal(next.documentType, "employment");
  assert.equal(next.category, "contract");
  assert.equal(next.holdout, false);
  assert.equal(next.authorAction, "recategorize");
  assert.equal(next.confidence, 1);
});
