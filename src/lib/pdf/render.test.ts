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
  });
  const withLogo = await renderDocumentPdf({
    theme: snapshot.styleTheme,
    document: resolved.document,
    logo: { kind: "png", bytes: PLACEHOLDER_LOGO_PNG },
  });
  const withoutLogo = await renderDocumentPdf({
    theme: snapshot.styleTheme,
    document: resolved.document,
    logo: { kind: "none" },
  });
  assert.ok(isPdfBuffer(withLogo));
  assert.ok(isPdfBuffer(withoutLogo));
});
