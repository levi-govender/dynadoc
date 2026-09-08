import assert from "node:assert/strict";
import test from "node:test";
import {
  LOGO_MAX_BYTES,
  assertWithinSizeLimit,
  buildObjectKey,
} from "./keys";

test("buildObjectKey prefixes org and document type", () => {
  assert.equal(
    buildObjectKey("org_1", "type_9", "logos", "mark.png"),
    "org_1/type_9/logos/mark.png",
  );
});

test("buildObjectKey rejects path traversal", () => {
  assert.throws(() => buildObjectKey("org_1", "type_9", "../secret"));
});

test("assertWithinSizeLimit rejects oversized logos", () => {
  assert.throws(() => assertWithinSizeLimit(LOGO_MAX_BYTES + 1, LOGO_MAX_BYTES));
  assert.doesNotThrow(() => assertWithinSizeLimit(LOGO_MAX_BYTES, LOGO_MAX_BYTES));
});
