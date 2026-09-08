import assert from "node:assert/strict";
import test from "node:test";
import fixture from "@/types/fixtures/employment-contract.json";
import { parseDocumentTypeExport } from "./export";
import { parseImportPayload, remapSnapshot } from "./import";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";

test("invalid import JSON is rejected", () => {
  assert.throws(() => parseImportPayload({ nope: true }));
  assert.throws(() => parseImportPayload("not json object"));
});

test("export payload is a valid single-type import", () => {
  const snapshot = parseDocumentTypeVersionSnapshot(fixture);
  const exported = parseDocumentTypeExport({
    name: "Employment",
    slug: "employment",
    source: "draft",
    snapshot,
  });
  const parsed = parseImportPayload(JSON.parse(JSON.stringify(exported)));
  assert.equal(parsed.kind, "documentType");
  if (parsed.kind !== "documentType") {
    return;
  }
  assert.equal(parsed.snapshot.template.blocks[0]?.id, "title");
});

test("import remaps ids so a second import does not collide", () => {
  const snapshot = parseDocumentTypeVersionSnapshot(fixture);
  const first = remapSnapshot(snapshot);
  const second = remapSnapshot(snapshot);
  assert.notEqual(first.formSchema.groups[0]?.id, snapshot.formSchema.groups[0]?.id);
  assert.notEqual(first.formSchema.groups[0]?.id, second.formSchema.groups[0]?.id);
  const firstStart = first.formSchema.groups[0]?.fields.find(
    (field) => field.label === "Start date",
  );
  const bind = first.template.blocks
    .flatMap((block) => block.children ?? [])
    .find((child) => child.type === "bind");
  assert.ok(firstStart && bind && bind.type === "bind");
  assert.equal(bind.field, firstStart.id);
});

test("family bundle parses with multiple members", () => {
  const snapshot = parseDocumentTypeVersionSnapshot(fixture);
  const parsed = parseImportPayload({
    kind: "family",
    name: "Employment family",
    slug: "employment-family",
    members: [
      { name: "Permanent pack", slug: "permanent-pack", snapshot },
      { name: "Fixed pack", slug: "fixed-pack", snapshot },
    ],
  });
  assert.equal(parsed.kind, "family");
  if (parsed.kind === "family") {
    assert.equal(parsed.members.length, 2);
  }
});
