import { auth } from "@/lib/auth";
import { toAuthzResponse } from "@/lib/auth/authz";
import { requireUserMembership } from "@/lib/auth/organizations";
import { INSTANCE_GENERATOR_ROLES, assertRole } from "@/lib/auth/roles";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/document-types/[id]/instances">,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const membership = await requireUserMembership(session.user.id);
    assertRole(membership, INSTANCE_GENERATOR_ROLES);
    return NextResponse.json(
      {
        documentTypeId: id,
        organizationId: membership.organizationId,
        status: "instance-stub",
      },
      { status: 201 },
    );
  } catch (error) {
    const response = toAuthzResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}
