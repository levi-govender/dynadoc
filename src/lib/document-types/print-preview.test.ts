import assert from "node:assert/strict";
import test from "node:test";
import fixture from "@/types/fixtures/employment-contract.json";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";
import { emptyDraftSnapshot } from "./defaults";
import {
  PLACEHOLDER_LOGO_SRC,
  printPreviewLogoSrc,
  printPreviewPageCss,
} from "./print-preview";

test("theme logoAssetId appears in print preview", () => {
  const snapshot = emptyDraftSnapshot();
  assert.ok(snapshot.styleTheme.letterhead.logoAssetId);
  assert.equal(
    printPreviewLogoSrc(snapshot.styleTheme),
    PLACEHOLDER_LOGO_SRC,
  );
  const css = printPreviewPageCss(snapshot.styleTheme);
  assert.equal(css.width, "210mm");
  assert.equal(css.paddingTop, "1in");
});

test("http logo URLs pass through; missing logo is omitted", () => {
  const snapshot = parseDocumentTypeVersionSnapshot(fixture);
  assert.equal(printPreviewLogoSrc(snapshot.styleTheme), null);
  assert.equal(
    printPreviewLogoSrc({
      ...snapshot.styleTheme,
      letterhead: {
        ...snapshot.styleTheme.letterhead,
        logoAssetId: "https://example.com/logo.png",
      },
    }),
    "https://example.com/logo.png",
  );
});
