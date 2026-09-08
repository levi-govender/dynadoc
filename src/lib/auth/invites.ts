import { randomBytes } from "node:crypto";
import { and, eq, ilike, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  memberships,
  organizationInvites,
  organizations,
  user,
  type MembershipRole,
} from "@/lib/db/schema";

export class InviteNotFoundError extends Error {
  constructor(message = "Invite not found") {
    super(message);
    this.name = "InviteNotFoundError";
  }
}

export class InviteExpiredError extends Error {
  constructor(message = "Invite has expired") {
    super(message);
    this.name = "InviteExpiredError";
  }
}

export class InviteEmailMismatchError extends Error {
  constructor(message = "Sign in with the invited email address") {
    super(message);
    this.name = "InviteEmailMismatchError";
  }
}

export class AlreadyMemberError extends Error {
  constructor(message = "That email is already a member of this organization") {
    super(message);
    this.name = "AlreadyMemberError";
  }
}

export const createInviteBodySchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  role: z.enum(["org_admin", "author", "operator"]),
});

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function newToken() {
  return randomBytes(32).toString("hex");
}

function inviteExpiry() {
  return new Date(Date.now() + INVITE_TTL_MS);
}

export async function listOrganizationMembers(organizationId: string) {
  const db = getDb();
  return db
    .select({
      membershipId: memberships.id,
      userId: memberships.userId,
      role: memberships.role,
      email: user.email,
      name: user.name,
      createdAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(user, eq(memberships.userId, user.id))
    .where(eq(memberships.organizationId, organizationId))
    .orderBy(user.email);
}

export async function listOrganizationInvites(organizationId: string) {
  const db = getDb();
  return db
    .select({
      id: organizationInvites.id,
      email: organizationInvites.email,
      role: organizationInvites.role,
      expiresAt: organizationInvites.expiresAt,
      acceptedAt: organizationInvites.acceptedAt,
      createdAt: organizationInvites.createdAt,
    })
    .from(organizationInvites)
    .where(
      and(
        eq(organizationInvites.organizationId, organizationId),
        isNull(organizationInvites.acceptedAt),
      ),
    )
    .orderBy(organizationInvites.createdAt);
}

export async function createOrganizationInvite(args: {
  organizationId: string;
  invitedBy: string;
  email: string;
  role: MembershipRole;
}) {
  const body = createInviteBodySchema.parse({
    email: args.email,
    role: args.role,
  });
  const db = getDb();

  const existingMember = await db
    .select({ id: memberships.id })
    .from(memberships)
    .innerJoin(user, eq(memberships.userId, user.id))
    .where(
      and(
        eq(memberships.organizationId, args.organizationId),
        ilike(user.email, body.email),
      ),
    )
    .limit(1);
  if (existingMember[0]) {
    throw new AlreadyMemberError();
  }

  const [pending] = await db
    .select()
    .from(organizationInvites)
    .where(
      and(
        eq(organizationInvites.organizationId, args.organizationId),
        eq(organizationInvites.email, body.email),
      ),
    )
    .limit(1);

  const token = newToken();
  const expiresAt = inviteExpiry();

  if (pending && pending.acceptedAt == null) {
    const [updated] = await db
      .update(organizationInvites)
      .set({
        role: body.role,
        token,
        invitedBy: args.invitedBy,
        expiresAt,
      })
      .where(eq(organizationInvites.id, pending.id))
      .returning();
    return { invite: updated ?? pending, duplicated: true };
  }

  if (pending?.acceptedAt) {
    await db
      .delete(organizationInvites)
      .where(eq(organizationInvites.id, pending.id));
  }

  const [invite] = await db
    .insert(organizationInvites)
    .values({
      organizationId: args.organizationId,
      email: body.email,
      role: body.role,
      token,
      invitedBy: args.invitedBy,
      expiresAt,
    })
    .returning();
  if (!invite) {
    throw new Error("Failed to create invite");
  }
  return { invite, duplicated: false };
}

export async function getInviteByToken(token: string) {
  const db = getDb();
  const [invite] = await db
    .select({
      invite: organizationInvites,
      organizationName: organizations.name,
    })
    .from(organizationInvites)
    .innerJoin(
      organizations,
      eq(organizationInvites.organizationId, organizations.id),
    )
    .where(eq(organizationInvites.token, token))
    .limit(1);
  if (!invite) {
    throw new InviteNotFoundError();
  }
  return invite;
}

export async function acceptInvite(args: {
  token: string;
  userId: string;
  email: string;
}) {
  const { invite } = await getInviteByToken(args.token);
  if (invite.expiresAt.getTime() < Date.now()) {
    throw new InviteExpiredError();
  }
  if (invite.email.toLowerCase() !== args.email.trim().toLowerCase()) {
    throw new InviteEmailMismatchError();
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.organizationId, invite.organizationId),
        eq(memberships.userId, args.userId),
      ),
    )
    .limit(1);
  if (existing) {
    if (invite.acceptedAt == null) {
      await db
        .update(organizationInvites)
        .set({ acceptedAt: new Date() })
        .where(eq(organizationInvites.id, invite.id));
    }
    return { membership: existing, invite };
  }

  const [membership] = await db
    .insert(memberships)
    .values({
      organizationId: invite.organizationId,
      userId: args.userId,
      role: invite.role,
    })
    .returning();
  if (!membership) {
    throw new Error("Failed to create membership");
  }
  await db
    .update(organizationInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(organizationInvites.id, invite.id));
  return { membership, invite };
}

export async function consumePendingInviteForNewUser(args: {
  userId: string;
  email: string;
}) {
  const db = getDb();
  const [pending] = await db
    .select()
    .from(organizationInvites)
    .where(
      and(
        eq(organizationInvites.email, args.email.trim().toLowerCase()),
        isNull(organizationInvites.acceptedAt),
        sql`${organizationInvites.expiresAt} > now()`,
      ),
    )
    .orderBy(organizationInvites.createdAt)
    .limit(1);
  if (!pending) {
    return null;
  }
  return acceptInvite({
    token: pending.token,
    userId: args.userId,
    email: args.email,
  });
}
