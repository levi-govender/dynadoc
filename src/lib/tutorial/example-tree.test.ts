import assert from "node:assert/strict";
import test from "node:test";
import { resolveDocument } from "@/lib/resolver/resolve";
import {
  EXAMPLE_ENGAGEMENT_ANSWERS,
  complexEngagementSnapshot,
} from "./example-tree";

const snapshot = complexEngagementSnapshot;

function blockIds(path: keyof typeof EXAMPLE_ENGAGEMENT_ANSWERS) {
  return resolveDocument(
    snapshot,
    EXAMPLE_ENGAGEMENT_ANSWERS[path],
  ).document.blocks.map((block) => block.id);
}

test("permanent employment keeps notice and drops contractor and end-date clauses", () => {
  const ids = blockIds("permanent");
  assert.ok(ids.includes("notice"));
  assert.ok(ids.includes("role"));
  assert.ok(ids.includes("duties"));
  assert.ok(!ids.includes("term-end"));
  assert.ok(!ids.includes("contractor-status"));
  assert.ok(!ids.includes("contractor-nda"));
});

test("fixed-term employment swaps notice for an end date", () => {
  const ids = blockIds("fixed-term");
  assert.ok(ids.includes("term-end"));
  assert.ok(!ids.includes("notice"));
  const result = resolveDocument(
    snapshot,
    EXAMPLE_ENGAGEMENT_ANSWERS["fixed-term"],
  );
  const role = result.document.blocks.find((block) => block.id === "role");
  assert.match(
    role?.children?.map((child) => child.text).join("") ?? "",
    /manager/i,
  );
});

test("contractor path uses entity rate, NDA, and two schedule rows", () => {
  const result = resolveDocument(
    snapshot,
    EXAMPLE_ENGAGEMENT_ANSWERS.contractor,
  );
  const ids = result.document.blocks.map((block) => block.id);
  assert.ok(ids.includes("contractor-status"));
  assert.ok(ids.includes("contractor-nda"));
  assert.ok(!ids.includes("notice"));
  assert.ok(!ids.includes("role"));
  const table = result.document.blocks.find(
    (block) => block.id === "schedule-table",
  );
  assert.equal(table?.rows?.length, 2);
  assert.match(
    table?.rows?.[0]?.map((span) => span.text).join("") ?? "",
    /Kickoff/,
  );
});
