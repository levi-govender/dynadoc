import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { memberships, organizations } from "@/lib/db/schema";

export class MembershipRequiredError extends Error {
  constructor(message = "Not a member of this organization") {
    super(message);
    this.name = "MembershipRequiredError";
  }
}

export async function ensureOrganizationForUser(input: {
  id: string;
  name: string;
  email: string;
}) {
  const db = getDb();
  const existing = await db
    .select({
      membershipId: memberships.id,
      organizationId: memberships.organizationId,
      role: memberships.role,
    })
    .from(memberships)
    .where(eq(memberships.userId, input.id))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const name = input.name.trim() || input.email.split("@")[0] || "Workspace";
  const [organization] = await db
    .insert(organizations)
    .values({
      externalId: `user:${input.id}`,
      name: `${name}'s workspace`,
    })
    .returning({ id: organizations.id });

  if (!organization) {
    throw new Error("Failed to create organization");
  }

  const [membership] = await db
    .insert(memberships)
    .values({
      organizationId: organization.id,
      userId: input.id,
      role: "org_admin",
    })
    .returning({
      membershipId: memberships.id,
      organizationId: memberships.organizationId,
      role: memberships.role,
    });

  if (!membership) {
    throw new Error("Failed to create membership");
  }

  return membership;
}

export async function requireUserMembership(userId: string) {
  const db = getDb();
  const [membership] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1);

  if (!membership) {
    throw new MembershipRequiredError();
  }

  return membership;
}

export async function requireMembership(organizationId: string, userId: string) {
  const db = getDb();
  const [membership] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.organizationId, organizationId),
        eq(memberships.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new MembershipRequiredError();
  }

  return membership;
}
