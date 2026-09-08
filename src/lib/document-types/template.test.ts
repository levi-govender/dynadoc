import assert from "node:assert/strict";
import test from "node:test";
import fixture from "@/types/fixtures/employment-contract.json";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";
import { emptyDraftSnapshot } from "./defaults";
import {
  addBlock,
  blockReferencesField,
  deleteBlock,
  moveBlock,
  setBlockText,
} from "./template";

test("addBlock uses a UUID and moveBlock reorders without changing ids", () => {
  let template = emptyDraftSnapshot().template;
  template = addBlock(template, "pageBreak");
  const added = template.blocks.at(-1);
  assert.ok(added);
  assert.match(added.id, /^[0-9a-f-]{36}$/i);
  assert.equal(added.type, "pageBreak");
  const firstId = template.blocks[0]?.id ?? "";
  template = moveBlock(template, added.id, -2);
  assert.equal(template.blocks[0]?.id, added.id);
  assert.equal(template.blocks[1]?.id, firstId);
});

test("setBlockText and deleteBlock persist on the template array", () => {
  let template = emptyDraftSnapshot().template;
  const headingId = template.blocks[0]?.id ?? "";
  template = setBlockText(template, headingId, "Contract");
  assert.deepEqual(template.blocks[0]?.children, [
    { type: "text", text: "Contract" },
  ]);
  template = deleteBlock(template, headingId);
  assert.equal(
    template.blocks.some((block) => block.id === headingId),
    false,
  );
});

test("selecting a field highlights blocks that bind or include it", () => {
  const template = parseDocumentTypeVersionSnapshot(fixture).template;
  const start = template.blocks.find((block) => block.id === "start");
  const notice = template.blocks.find((block) => block.id === "notice");
  const title = template.blocks.find((block) => block.id === "title");
  assert.ok(start && notice && title);
  assert.equal(blockReferencesField(start, "startDate"), true);
  assert.equal(blockReferencesField(notice, "employmentType"), true);
  assert.equal(blockReferencesField(notice, "noticeWeeks"), true);
  assert.equal(blockReferencesField(title, "startDate"), false);
});
