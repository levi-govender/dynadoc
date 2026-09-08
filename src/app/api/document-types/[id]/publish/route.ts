import { auth } from "@/lib/auth";
import { toAuthzResponse } from "@/lib/auth/authz";
import { requireUserMembership } from "@/lib/auth/organizations";
import { DRAFT_EDITOR_ROLES, assertRole } from "@/lib/auth/roles";
import { publishDocumentType } from "@/lib/document-types/versions";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const membership = await requireUserMembership(session.user.id);
    assertRole(membership, DRAFT_EDITOR_ROLES);
    const { type, version, snapshot } = await publishDocumentType({
      organizationId: membership.organizationId,
      documentTypeId: id,
      publishedBy: session.user.id,
    });
    return NextResponse.json({
      id: type.id,
      status: type.status,
      publishedVersionId: type.publishedVersionId,
      publishedAt: type.publishedAt,
      publishedBy: type.publishedBy,
      version: {
        id: version.id,
        versionNumber: version.versionNumber,
        snapshot,
      },
    });
  } catch (error) {
    const response = toAuthzResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}
