import assert from "node:assert/strict";
import test from "node:test";
import { parseInstanceListQuery } from "./instances";

test("parseInstanceListQuery reads type and date filters", () => {
  const query = parseInstanceListQuery({
    documentTypeId: "3d58f377-6f4f-8187-b285-d01a8a3a34f9",
    from: "2026-04-01",
    to: "2026-04-30",
  });
  assert.equal(query.documentTypeId, "3d58f377-6f4f-8187-b285-d01a8a3a34f9");
  assert.equal(query.from, "2026-04-01");
  assert.equal(query.to, "2026-04-30");
});

test("parseInstanceListQuery allows empty filters", () => {
  const query = parseInstanceListQuery({});
  assert.equal(query.documentTypeId, undefined);
  assert.equal(query.from, undefined);
  assert.equal(query.to, undefined);
});
