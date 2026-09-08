import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_GROUP_TITLE, emptyDraftSnapshot, slugFromName } from "./defaults";

test("empty draft has one group, heading, paragraph, and A4 serif theme", () => {
  const snapshot = emptyDraftSnapshot();
  assert.equal(snapshot.formSchema.groups.length, 1);
  assert.equal(snapshot.formSchema.groups[0]?.title, DEFAULT_GROUP_TITLE);
  assert.equal(snapshot.formSchema.groups[0]?.fields.length, 0);
  assert.equal(snapshot.template.blocks[0]?.type, "heading");
  assert.equal(snapshot.template.blocks[1]?.type, "paragraph");
  assert.equal(snapshot.styleTheme.page.size, "A4");
  assert.equal(snapshot.styleTheme.typography.body.family, "Times New Roman");
});

test("slugFromName kebab-cases a title", () => {
  assert.equal(slugFromName("Employment contract"), "employment-contract");
});
