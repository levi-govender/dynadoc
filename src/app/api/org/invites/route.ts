import { auth } from "@/lib/auth";
import { toAuthzResponse } from "@/lib/auth/authz";
import { requireUserMembership } from "@/lib/auth/organizations";
import { ORG_ADMIN_ROLES, assertRole } from "@/lib/auth/roles";
import {
  createInviteBodySchema,
  createOrganizationInvite,
  listOrganizationInvites,
  listOrganizationMembers,
} from "@/lib/auth/invites";
import { sendInviteEmail } from "@/lib/auth/send-invite-email";
import { getDb } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const membership = await requireUserMembership(session.user.id);
    assertRole(membership, ORG_ADMIN_ROLES);
    const [members, invites] = await Promise.all([
      listOrganizationMembers(membership.organizationId),
      listOrganizationInvites(membership.organizationId),
    ]);
    return NextResponse.json({
      organizationId: membership.organizationId,
      members,
      invites,
    });
  } catch (error) {
    const response = toAuthzResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const membership = await requireUserMembership(session.user.id);
    assertRole(membership, ORG_ADMIN_ROLES);
    const parsed = createInviteBodySchema.parse(await request.json());
    const { invite, duplicated } = await createOrganizationInvite({
      organizationId: membership.organizationId,
      invitedBy: session.user.id,
      email: parsed.email,
      role: parsed.role,
    });
    const origin = new URL(request.url).origin;
    const acceptUrl = `${origin}/invite/${invite.token}`;
    const [org] = await getDb()
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, membership.organizationId))
      .limit(1);
    const email = await sendInviteEmail({
      to: invite.email,
      organizationName: org?.name ?? "Dynadoc",
      role: invite.role,
      acceptUrl,
    });
    return NextResponse.json(
      {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        duplicated,
        acceptUrl,
        delivered: email.delivered,
        expiresAt: invite.expiresAt,
      },
      { status: duplicated ? 200 : 201 },
    );
  } catch (error) {
    const response = toAuthzResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}
