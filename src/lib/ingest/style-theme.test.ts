import assert from "node:assert/strict";
import test from "node:test";
import { emptyDraftSnapshot } from "@/lib/document-types/defaults";
import {
  applyStyleThemeToDraft,
  extractLayoutHints,
  proposeStyleTheme,
} from "./style-theme";

test("US letterhead wording proposes Letter + letterhead footer, not a scan clone", () => {
  const hints = extractLayoutHints([
    "ACME Incorporated\n123 Market Street\n94105\nUnited States\nletter size\n\nThe employer and the employee agree.",
  ]);
  assert.equal(hints.pageSize, "Letter");
  assert.equal(hints.footerMode, "letterhead");
  assert.equal(hints.logoPosition, "left");
  assert.equal(hints.signatureCount, 2);
  const theme = proposeStyleTheme(hints);
  assert.equal(theme.page.size, "Letter");
  assert.equal(theme.typography.body.family, "Times New Roman");
  assert.equal(theme.letterhead.logoAssetId, "placeholder-logo");
  assert.equal(theme.signatures.blocks.length, 2);
});

test("plain A4 contract keeps default professional page size", () => {
  const hints = extractLayoutHints([
    "Employment agreement\n\nThis agreement is made between the parties.",
  ]);
  assert.equal(hints.pageSize, "A4");
  const theme = proposeStyleTheme(hints);
  assert.equal(theme.page.size, "A4");
  assert.equal(theme.letterhead.footerMode, "pageNumbers");
});

test("accepting a proposal updates style_theme only", () => {
  const snapshot = emptyDraftSnapshot();
  const theme = proposeStyleTheme(
    extractLayoutHints(["United States\nletter size\nPty Ltd"]),
  );
  const next = applyStyleThemeToDraft(snapshot, theme);
  assert.deepEqual(next.formSchema, snapshot.formSchema);
  assert.deepEqual(next.template, snapshot.template);
  assert.equal(next.styleTheme.page.size, theme.page.size);
  assert.notEqual(next.styleTheme.page.size, snapshot.styleTheme.page.size);
});
