import { auth } from "@/lib/auth";
import { toAuthzResponse } from "@/lib/auth/authz";
import { requireUserMembership } from "@/lib/auth/organizations";
import { DRAFT_EDITOR_ROLES, assertRole } from "@/lib/auth/roles";
import { exportDocumentType } from "@/lib/document-types/export";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

function parseSource(value: string | null): "draft" | "published" | null {
  if (value === "draft" || value === "published") {
    return value;
  }
  return null;
}

export async function GET(
  request: Request,
  context: RouteContext<"/api/document-types/[id]/export">,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const source = parseSource(new URL(request.url).searchParams.get("source"));
  if (!source) {
    return NextResponse.json(
      { error: "Query source must be draft or published" },
      { status: 400 },
    );
  }

  try {
    const { id } = await context.params;
    const membership = await requireUserMembership(session.user.id);
    assertRole(membership, DRAFT_EDITOR_ROLES);
    const exported = await exportDocumentType({
      organizationId: membership.organizationId,
      documentTypeId: id,
      source,
    });
    return NextResponse.json(exported, {
      headers: {
        "Content-Disposition": `attachment; filename="${exported.slug}-${source}.json"`,
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
