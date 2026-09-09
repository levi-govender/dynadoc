import { auth } from "@/lib/auth";
import { toAuthzResponse } from "@/lib/auth/authz";
import { requireUserMembership } from "@/lib/auth/organizations";
import { DRAFT_EDITOR_ROLES, assertRole } from "@/lib/auth/roles";
import { classifyIngestJob, serializeIngestJob } from "@/lib/ingest/jobs";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/ingest-jobs/[id]/classify">,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    const membership = await requireUserMembership(session.user.id);
    assertRole(membership, DRAFT_EDITOR_ROLES);
    const loaded = await classifyIngestJob({
      organizationId: membership.organizationId,
      jobId: id,
      userId: session.user.id,
    });
    return NextResponse.json(serializeIngestJob(loaded));
  } catch (error) {
    const response = toAuthzResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}
