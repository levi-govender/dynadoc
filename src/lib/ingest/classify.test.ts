import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyIngestFile,
  heuristicClassify,
  INGEST_LOW_CONFIDENCE,
} from "./classify";

test("invoice in a contract job is holdout, not in-family", async () => {
  const result = await classifyIngestFile({
    filename: "acme-invoice.pdf",
    extractedText:
      "TAX INVOICE\nBill to: Acme\nAmount due: 1200\nVAT 15%\nPlease pay this invoice.",
    declaredCategory: "contract",
  });
  assert.equal(result.documentType, "invoice");
  assert.equal(result.category, "other");
  assert.equal(result.inFamily, false);
  assert.equal(result.holdout, true);
  assert.ok(result.confidence >= INGEST_LOW_CONFIDENCE);
});

test("employment contract in a contract job can be in-family", async () => {
  const result = await classifyIngestFile({
    filename: "offer.docx",
    extractedText:
      "This employment agreement is between the employer and the employee. Notice period is four weeks.",
    declaredCategory: "contract",
  });
  assert.equal(result.documentType, "employment");
  assert.equal(result.inFamily, true);
  assert.equal(result.holdout, false);
});

test("low confidence text is holdout and not auto-include", () => {
  const labels = heuristicClassify({
    filename: "scan.pdf",
    text: "Hello world page one",
  });
  assert.ok(labels.confidence < INGEST_LOW_CONFIDENCE);
});
