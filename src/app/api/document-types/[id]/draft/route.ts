import { auth } from "@/lib/auth";
import { toAuthzResponse } from "@/lib/auth/authz";
import { requireUserMembership } from "@/lib/auth/organizations";
import { DRAFT_EDITOR_ROLES, assertRole } from "@/lib/auth/roles";
import { getDocumentType, saveDraft } from "@/lib/document-types/versions";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/document-types/[id]/draft">,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const membership = await requireUserMembership(session.user.id);
    assertRole(membership, DRAFT_EDITOR_ROLES);
    const type = await getDocumentType({
      organizationId: membership.organizationId,
      documentTypeId: id,
    });
    return NextResponse.json({
      id: type.id,
      status: type.status,
      organizationId: type.organizationId,
      draftSnapshot: type.draftSnapshot,
      publishedVersionId: type.publishedVersionId,
      publishedAt: type.publishedAt,
      publishedBy: type.publishedBy,
    });
  } catch (error) {
    const response = toAuthzResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}

export async function PUT(
  request: Request,
  context: RouteContext<"/api/document-types/[id]/draft">,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const membership = await requireUserMembership(session.user.id);
    assertRole(membership, DRAFT_EDITOR_ROLES);
    const body: unknown = await request.json();
    const { type, snapshot } = await saveDraft({
      organizationId: membership.organizationId,
      documentTypeId: id,
      snapshot: body,
    });
    return NextResponse.json({
      id: type.id,
      status: type.status,
      organizationId: type.organizationId,
      draftSnapshot: snapshot,
      publishedVersionId: type.publishedVersionId,
    });
  } catch (error) {
    const response = toAuthzResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}
