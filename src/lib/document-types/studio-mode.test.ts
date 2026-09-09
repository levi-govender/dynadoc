import assert from "node:assert/strict";
import test from "node:test";
import { emptyDraftSnapshot } from "./defaults";
import { snapshotUsesAdvancedRules } from "./studio-mode";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";
import fixture from "@/types/fixtures/employment-contract.json";

test("empty draft stays in simple studio", () => {
  assert.equal(snapshotUsesAdvancedRules(emptyDraftSnapshot()), false);
});

test("branched employment fixture opens advanced studio", () => {
  assert.equal(
    snapshotUsesAdvancedRules(parseDocumentTypeVersionSnapshot(fixture)),
    true,
  );
});
