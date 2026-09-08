import { auth } from "@/lib/auth";
import { toAuthzResponse } from "@/lib/auth/authz";
import { requireUserMembership } from "@/lib/auth/organizations";
import { DRAFT_EDITOR_ROLES, assertRole } from "@/lib/auth/roles";
import { assertPublishedVersionImmutable } from "@/lib/document-types/versions";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string; versionId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, versionId } = await context.params;
    void id;
    void versionId;
    const membership = await requireUserMembership(session.user.id);
    assertRole(membership, DRAFT_EDITOR_ROLES);
    return assertPublishedVersionImmutable();
  } catch (error) {
    const response = toAuthzResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}
