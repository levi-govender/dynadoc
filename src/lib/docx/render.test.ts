import assert from "node:assert/strict";
import test from "node:test";
import fixture from "@/types/fixtures/employment-contract.json";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";
import { resolveDocument } from "@/lib/resolver/resolve";
import { issuedDocxFilename, renderDocumentDocx, resolvedClauseTexts } from "./render";

test("docx contains the same clause text as the resolved AST", async () => {
  const snapshot = parseDocumentTypeVersionSnapshot(fixture);
  const resolved = resolveDocument(snapshot, {
    employmentType: "permanent",
    jobTitle: "Engineer",
    startDate: "2026-01-01",
    noticeWeeks: 4,
  });
  const clauses = resolvedClauseTexts(resolved.document);
  assert.ok(clauses.some((text) => text.includes("Engineer") || /engineer/i.test(text)));
  const bytes = await renderDocumentDocx({ document: resolved.document });
  assert.equal(bytes.subarray(0, 2).toString("ascii"), "PK");
  const mammoth = await import("mammoth");
  const extracted = await mammoth.extractRawText({ buffer: bytes });
  const body = extracted.value ?? "";
  for (const clause of clauses) {
    const snippet = clause.replace(/\s+/g, " ").trim().slice(0, 40);
    if (snippet.length < 8) {
      continue;
    }
    assert.ok(
      body.includes(snippet) || body.replace(/\s+/g, " ").includes(snippet),
      `missing clause snippet: ${snippet}`,
    );
  }
});

test("issued docx filename uses the type slug", () => {
  assert.match(issuedDocxFilename("employment", new Date("2026-01-02T00:00:00Z")), /\.docx$/);
  assert.match(issuedDocxFilename("employment", new Date("2026-01-02T00:00:00Z")), /employment/);
});
