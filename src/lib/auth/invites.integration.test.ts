import assert from "node:assert/strict";
import { after } from "node:test";
import { config } from "dotenv";
import test from "node:test";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/lib/db";
import { memberships, organizations, user } from "@/lib/db/schema";
import {
  AlreadyMemberError,
  acceptInvite,
  createOrganizationInvite,
} from "./invites";

config({ path: ".env.local" });
config({ path: ".env" });

function isPostgresUnavailable(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return text.includes("ECONNREFUSED") || text.includes("does not exist");
}

test("invite joins the org with the chosen role; duplicate refreshes the token", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not set");
    return;
  }
  try {
    const db = getDb();
    const stamp = Date.now();
    const [org] = await db
      .insert(organizations)
      .values({
        externalId: `invite-org-${stamp}`,
        name: "Invite org",
      })
      .returning({ id: organizations.id });
    assert.ok(org);
    const [admin] = await db
      .insert(user)
      .values({
        id: `invite-admin-${stamp}`,
        name: "Admin",
        email: `admin-${stamp}@example.com`,
        emailVerified: true,
      })
      .returning({ id: user.id });
    assert.ok(admin);

    const first = await createOrganizationInvite({
      organizationId: org.id,
      invitedBy: admin.id,
      email: `op-${stamp}@example.com`,
      role: "operator",
    });
    const second = await createOrganizationInvite({
      organizationId: org.id,
      invitedBy: admin.id,
      email: `op-${stamp}@example.com`,
      role: "author",
    });
    assert.equal(second.duplicated, true);
    assert.notEqual(second.invite.token, first.invite.token);
    assert.equal(second.invite.role, "author");

    const [invitee] = await db
      .insert(user)
      .values({
        id: `invitee-${stamp}`,
        name: "Invitee",
        email: `op-${stamp}@example.com`,
        emailVerified: true,
      })
      .returning({ id: user.id });
    assert.ok(invitee);

    const accepted = await acceptInvite({
      token: second.invite.token,
      userId: invitee.id,
      email: `op-${stamp}@example.com`,
    });
    assert.equal(accepted.membership.organizationId, org.id);
    assert.equal(accepted.membership.role, "author");

    await assert.rejects(
      () =>
        createOrganizationInvite({
          organizationId: org.id,
          invitedBy: admin.id,
          email: `op-${stamp}@example.com`,
          role: "operator",
        }),
      AlreadyMemberError,
    );

    const [row] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, invitee.id));
    assert.equal(row?.role, "author");
  } catch (error) {
    if (error instanceof assert.AssertionError) {
      throw error;
    }
    if (isPostgresUnavailable(error)) {
      t.skip("Postgres is not running or schema is not migrated");
      return;
    }
    throw error;
  }
});

after(async () => {
  await closeDb();
});
