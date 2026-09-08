import assert from "node:assert/strict";
import test from "node:test";
import "./hyphenate-cjs-patch";
import fixture from "@/types/fixtures/employment-contract.json";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";
import { resolveDocument } from "@/lib/resolver/resolve";

test("PDF buffer is valid with and without a logo", async () => {
  const { PLACEHOLDER_LOGO_PNG, isPdfBuffer, renderDocumentPdf } = await import(
    "./render"
  );
  const snapshot = parseDocumentTypeVersionSnapshot(fixture);
  const resolved = resolveDocument(snapshot, {
    employmentType: "permanent",
    jobTitle: "Engineer",
    startDate: "2026-01-01",
    noticeWeeks: 4,
    employeeName: "Alex Rivera",
    employerName: "Acme Ltd",
  });
  const withLogo = await renderDocumentPdf({
    theme: snapshot.styleTheme,
    document: resolved.document,
    logo: { kind: "png", bytes: PLACEHOLDER_LOGO_PNG },
    answers: resolved.answers,
  });
  const withoutLogo = await renderDocumentPdf({
    theme: snapshot.styleTheme,
    document: resolved.document,
    logo: { kind: "none" },
    answers: resolved.answers,
  });
  assert.ok(isPdfBuffer(withLogo));
  assert.ok(isPdfBuffer(withoutLogo));
  assert.equal(snapshot.styleTheme.signatures.blocks.length, 2);
});

test("PDF renders an uploaded signature image", async () => {
  const { PLACEHOLDER_LOGO_PNG, isPdfBuffer, renderDocumentPdf } = await import(
    "./render"
  );
  const snapshot = parseDocumentTypeVersionSnapshot(fixture);
  const pngData = `data:image/png;base64,${PLACEHOLDER_LOGO_PNG.toString("base64")}`;
  const resolved = resolveDocument(snapshot, {
    employmentType: "contractor",
    jobTitle: "Engineer",
    startDate: "2026-01-01",
    employeeSignatureImage: pngData,
  });
  const bytes = await renderDocumentPdf({
    theme: snapshot.styleTheme,
    document: resolved.document,
    logo: { kind: "none" },
    answers: resolved.answers,
  });
  assert.ok(isPdfBuffer(bytes));
});
