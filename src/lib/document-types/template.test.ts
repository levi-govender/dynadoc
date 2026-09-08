import assert from "node:assert/strict";
import test from "node:test";
import fixture from "@/types/fixtures/employment-contract.json";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";
import { resolveDocument } from "@/lib/resolver/resolve";
import { emptyDraftSnapshot } from "./defaults";
import { addField } from "./form-schema";
import {
  addBlock,
  appendBind,
  appendVariantMap,
  blockReferencesField,
  deleteBlock,
  moveBlock,
  setBlockIncludeWhen,
  setBlockText,
  setVariantMapEntry,
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

test("appendBind interpolates a typed sample answer", () => {
  const snapshot = emptyDraftSnapshot();
  const groupId = snapshot.formSchema.groups[0]?.id ?? "";
  const form = addField(snapshot.formSchema, groupId, "text");
  const fieldId = form.groups[0]?.fields[0]?.id ?? "";
  const paragraphId = snapshot.template.blocks[1]?.id ?? "";
  let template = setBlockText(snapshot.template, paragraphId, "Hello ");
  template = appendBind(template, paragraphId, fieldId);
  const result = resolveDocument(
    { ...snapshot, formSchema: form, template },
    { [fieldId]: "Ada" },
  );
  const block = result.document.blocks.find((entry) => entry.id === paragraphId);
  assert.equal(
    (block?.children ?? []).map((child) => child.text).join(""),
    "Hello Ada",
  );
});

test("variant map wording follows the sample select value", () => {
  const snapshot = parseDocumentTypeVersionSnapshot(fixture);
  let template = appendVariantMap(snapshot.template, "title", "jobTitle", [
    "Engineer",
    "Manager",
  ]);
  const mapIndex =
    (template.blocks.find((block) => block.id === "title")?.children?.length ??
      1) - 1;
  template = setVariantMapEntry(
    template,
    "title",
    mapIndex,
    "Engineer",
    "Engineer heading",
  );
  template = setVariantMapEntry(
    template,
    "title",
    mapIndex,
    "Manager",
    "Manager heading",
  );
  const heading = (jobTitle: string) => {
    const result = resolveDocument(
      { ...snapshot, template },
      { employmentType: "contractor", jobTitle },
    );
    return (result.document.blocks.find((block) => block.id === "title")
      ?.children ?? [])
      .map((child) => child.text)
      .join("");
  };
  assert.match(heading("Engineer"), /Engineer heading/);
  assert.match(heading("Manager"), /Manager heading/);
});

test("permanent-only includeWhen drops the clause for fixed-term samples", () => {
  const snapshot = parseDocumentTypeVersionSnapshot(fixture);
  const notice = snapshot.template.blocks.find((block) => block.id === "notice");
  assert.ok(notice?.includeWhen);
  const template = setBlockIncludeWhen(snapshot.template, "notice", {
    op: "eq",
    field: "employmentType",
    value: "permanent",
  });
  const fixedTerm = resolveDocument(
    { ...snapshot, template },
    {
      employmentType: "fixed-term",
      jobTitle: "Engineer",
      startDate: "2026-04-01",
      endDate: "2027-03-31",
    },
  );
  const permanent = resolveDocument(
    { ...snapshot, template },
    {
      employmentType: "permanent",
      jobTitle: "Engineer",
      startDate: "2026-04-01",
      noticeWeeks: 4,
    },
  );
  assert.equal(
    fixedTerm.document.blocks.some((block) => block.id === "notice"),
    false,
  );
  assert.equal(
    permanent.document.blocks.some((block) => block.id === "notice"),
    true,
  );
});
