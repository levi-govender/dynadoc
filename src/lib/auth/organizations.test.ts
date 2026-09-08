import assert from "node:assert/strict";
import test from "node:test";
import { MembershipRequiredError } from "./organizations";

test("MembershipRequiredError is distinguishable", () => {
  const error = new MembershipRequiredError();
  assert.equal(error.name, "MembershipRequiredError");
});
