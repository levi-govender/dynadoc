import assert from "node:assert/strict";
import test from "node:test";
import { issuedPdfObjectKey } from "./issue";

test("each instance gets a distinct issued PDF object key", () => {
  const first = issuedPdfObjectKey({
    organizationId: "org-a",
    documentTypeId: "type-b",
    instanceId: "instance-1",
  });
  const second = issuedPdfObjectKey({
    organizationId: "org-a",
    documentTypeId: "type-b",
    instanceId: "instance-2",
  });
  assert.equal(first, "org-a/type-b/instances/instance-1/issued.pdf");
  assert.equal(second, "org-a/type-b/instances/instance-2/issued.pdf");
  assert.notEqual(first, second);
});
