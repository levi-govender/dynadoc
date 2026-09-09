import assert from "node:assert/strict";
import { after } from "node:test";
import { config } from "dotenv";
import test from "node:test";
import { closeDb, getDb } from "@/lib/db";
import { memberships, organizations, user } from "@/lib/db/schema";
import { listNotifications, markNotificationRead, notify } from "./index";

config({ path: ".env.local" });
config({ path: ".env" });

function isPostgresUnavailable(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return (
    text.includes("ECONNREFUSED") ||
    text.includes("does not exist") ||
    text.includes("user_id")
  );
}

test("creating a notification shows in that user's inbox only", async (t) => {
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
        externalId: `notify-org-${stamp}`,
        name: "Notify org",
      })
      .returning({ id: organizations.id });
    assert.ok(org);
    const [alice] = await db
      .insert(user)
      .values({
        id: `notify-alice-${stamp}`,
        name: "Alice",
        email: `alice-${stamp}@example.com`,
        emailVerified: true,
      })
      .returning({ id: user.id });
    const [bob] = await db
      .insert(user)
      .values({
        id: `notify-bob-${stamp}`,
        name: "Bob",
        email: `bob-${stamp}@example.com`,
        emailVerified: true,
      })
      .returning({ id: user.id });
    assert.ok(alice);
    assert.ok(bob);
    await db.insert(memberships).values([
      {
        organizationId: org.id,
        userId: alice.id,
        role: "author",
      },
      {
        organizationId: org.id,
        userId: bob.id,
        role: "operator",
      },
    ]);

    const created = await notify({
      organizationId: org.id,
      userId: alice.id,
      type: "ingest_rereview",
      payload: { reason: "clause mismatch" },
    });
    const aliceInbox = await listNotifications({
      organizationId: org.id,
      userId: alice.id,
    });
    const bobInbox = await listNotifications({
      organizationId: org.id,
      userId: bob.id,
    });
    assert.equal(aliceInbox.length, 1);
    assert.equal(aliceInbox[0]?.id, created.id);
    assert.equal(aliceInbox[0]?.kind, "ingest_rereview");
    assert.equal(bobInbox.length, 0);

    const read = await markNotificationRead({
      organizationId: org.id,
      userId: alice.id,
      notificationId: created.id,
    });
    assert.ok(read.readAt);
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
