import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  extractIngestText,
  ingestFileKind,
  parseIngestCategory,
  parseIngestMode,
  InvalidIngestMetaError,
} from "./extract";
import { toAuthzResponse } from "@/lib/auth/authz";
import { IngestJobNotFoundError } from "./jobs";

const helloDocx = readFileSync(
  path.join(import.meta.dirname, "fixtures/hello.docx"),
);

test("ingestFileKind accepts pdf and docx only", () => {
  assert.equal(ingestFileKind("a.PDF", ""), "pdf");
  assert.equal(ingestFileKind("a.docx", ""), "docx");
  assert.equal(ingestFileKind("a.png", "image/png"), "unsupported");
});

test("parseIngestCategory and mode reject unknown values", () => {
  assert.equal(parseIngestCategory("contract"), "contract");
  assert.equal(parseIngestMode("decompose"), "decompose");
  assert.throws(() => parseIngestCategory("invoice"), InvalidIngestMetaError);
  assert.throws(() => parseIngestMode("cluster"), InvalidIngestMetaError);
});

test("extractIngestText lists unsupported files as errors", async () => {
  const result = await extractIngestText({
    filename: "notes.txt",
    contentType: "text/plain",
    bytes: Buffer.from("hello"),
  });
  assert.equal(result.kind, "unsupported");
  assert.match(result.error ?? "", /Unsupported/);
});

test("extractIngestText reads docx wording", async () => {
  const result = await extractIngestText({
    filename: "hello.docx",
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    bytes: helloDocx,
  });
  assert.equal(result.error, null);
  assert.match(result.text ?? "", /Hello ingest docx/);
});

test("extractIngestText reads PDF wording", async () => {
  const { renderDocumentPdf } = await import("@/lib/pdf/render");
  const { parseDocumentTypeVersionSnapshot } = await import(
    "@/types/document-type"
  );
  const { resolveDocument } = await import("@/lib/resolver/resolve");
  const fixture = (
    await import("@/types/fixtures/employment-contract.json")
  ).default;
  const snapshot = parseDocumentTypeVersionSnapshot(fixture);
  const resolved = resolveDocument(snapshot, {
    employmentType: "permanent",
    jobTitle: "Engineer",
    startDate: "2026-01-01",
    noticeWeeks: 4,
  });
  const bytes = await renderDocumentPdf({
    theme: snapshot.styleTheme,
    document: resolved.document,
    logo: { kind: "none" },
    answers: resolved.answers,
  });
  const result = await extractIngestText({
    filename: "contract.pdf",
    contentType: "application/pdf",
    bytes,
  });
  assert.equal(result.error, null);
  assert.ok((result.text ?? "").length > 0);
});

test("missing ingest job maps to HTTP 404", () => {
  const response = toAuthzResponse(new IngestJobNotFoundError());
  assert.equal(response?.status, 404);
});
