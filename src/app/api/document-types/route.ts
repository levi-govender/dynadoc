import { auth } from "@/lib/auth";
import { toAuthzResponse } from "@/lib/auth/authz";
import { requireUserMembership } from "@/lib/auth/organizations";
import { DRAFT_EDITOR_ROLES, assertRole } from "@/lib/auth/roles";
import {
  createDocumentType,
  createDocumentTypeBodySchema,
  listDocumentTypes,
} from "@/lib/document-types/create";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const membership = await requireUserMembership(session.user.id);
    assertRole(membership, DRAFT_EDITOR_ROLES);
    const types = await listDocumentTypes(membership.organizationId);
    return NextResponse.json({
      organizationId: membership.organizationId,
      types,
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
    assertRole(membership, DRAFT_EDITOR_ROLES);
    const parsed = createDocumentTypeBodySchema.parse(await request.json());
    const type = await createDocumentType({
      organizationId: membership.organizationId,
      name: parsed.name,
      slug: parsed.slug,
    });
    return NextResponse.json(
      {
        id: type.id,
        name: type.name,
        slug: type.slug,
        status: type.status,
        organizationId: type.organizationId,
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
