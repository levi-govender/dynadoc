import assert from "node:assert/strict";
import test from "node:test";
import { toAuthzResponse } from "./authz";
import {
  DRAFT_EDITOR_ROLES,
  INSTANCE_GENERATOR_ROLES,
  RoleForbiddenError,
  assertRole,
  canEditDraft,
  canGenerateInstance,
  canManageOrganization,
} from "./roles";

test("assertRole allows listed roles and rejects others", () => {
  assert.doesNotThrow(() =>
    assertRole({ role: "author" }, DRAFT_EDITOR_ROLES),
  );
  assert.doesNotThrow(() =>
    assertRole({ role: "org_admin" }, DRAFT_EDITOR_ROLES),
  );
  assert.throws(
    () => assertRole({ role: "operator" }, DRAFT_EDITOR_ROLES),
    (error: unknown) =>
      error instanceof RoleForbiddenError &&
      error.name === "RoleForbiddenError",
  );
});

test("operator cannot edit drafts; author and org_admin can", () => {
  assert.equal(canEditDraft("operator"), false);
  assert.equal(canEditDraft("author"), true);
  assert.equal(canEditDraft("org_admin"), true);
});

test("operator can generate instances of published types", () => {
  assert.equal(canGenerateInstance("operator"), true);
  assert.doesNotThrow(() =>
    assertRole({ role: "operator" }, INSTANCE_GENERATOR_ROLES),
  );
});

test("only org_admin can invite and set branding later", () => {
  assert.equal(canManageOrganization("org_admin"), true);
  assert.equal(canManageOrganization("author"), false);
  assert.equal(canManageOrganization("operator"), false);
});

test("assertRole uses membership.role, not a client-claimed role string", () => {
  const claimedRole = "org_admin";
  const membership = { role: "operator" as const };
  assert.notEqual(claimedRole, membership.role);
  assert.throws(
    () => assertRole(membership, DRAFT_EDITOR_ROLES),
    RoleForbiddenError,
  );
});

test("operator hitting a draft route maps to HTTP 403", () => {
  try {
    assertRole({ role: "operator" }, DRAFT_EDITOR_ROLES);
    assert.fail("expected RoleForbiddenError");
  } catch (error) {
    const response = toAuthzResponse(error);
    assert.equal(response?.status, 403);
  }
});
