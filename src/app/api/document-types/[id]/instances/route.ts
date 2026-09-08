import { auth } from "@/lib/auth";
import { toAuthzResponse } from "@/lib/auth/authz";
import { requireUserMembership } from "@/lib/auth/organizations";
import { INSTANCE_GENERATOR_ROLES, assertRole } from "@/lib/auth/roles";
import { createInstanceFromPublished } from "@/lib/document-types/versions";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
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
    let answers: unknown = {};
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body: unknown = await request.json();
      if (
        body &&
        typeof body === "object" &&
        "answers" in body &&
        body.answers !== undefined
      ) {
        answers = body.answers;
      }
    }
    const { instance, snapshot, version, resolved } =
      await createInstanceFromPublished({
        organizationId: membership.organizationId,
        documentTypeId: id,
        createdBy: session.user.id,
        answers,
      });
    return NextResponse.json(
      {
        id: instance.id,
        documentTypeId: id,
        documentTypeVersionId: version.id,
        organizationId: membership.organizationId,
        snapshot,
        answers: resolved.answers,
        resolved: resolved.document,
        warnings: resolved.warnings,
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
