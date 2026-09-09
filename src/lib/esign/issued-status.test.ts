import assert from "node:assert/strict";
import test from "node:test";
import { issuedStatusLabel } from "./issued-status";

test("issued files without an envelope are Issued", () => {
  assert.equal(issuedStatusLabel({ envelopeId: null, status: null }), "Issued");
});

test("completed envelopes read as Signed", () => {
  assert.equal(
    issuedStatusLabel({ envelopeId: "env_1", status: "completed" }),
    "Signed",
  );
});

test("sent envelopes read as Sent for signature", () => {
  assert.equal(
    issuedStatusLabel({ envelopeId: "env_1", status: "sent" }),
    "Sent for signature",
  );
});
