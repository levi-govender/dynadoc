import { auth } from "@/lib/auth";
import { toAuthzResponse } from "@/lib/auth/authz";
import { requireUserMembership } from "@/lib/auth/organizations";
import { DRAFT_EDITOR_ROLES, assertRole } from "@/lib/auth/roles";
import { saveIngestJobDrafts, serializeIngestJob } from "@/lib/ingest/jobs";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  confirmed: z.literal(true),
});

export async function POST(
  request: Request,
  context: RouteContext<"/api/ingest-jobs/[id]/drafts">,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    const membership = await requireUserMembership(session.user.id);
    assertRole(membership, DRAFT_EDITOR_ROLES);
    const body = bodySchema.parse(await request.json());
    const loaded = await saveIngestJobDrafts({
      organizationId: membership.organizationId,
      jobId: id,
      confirmed: body.confirmed,
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
