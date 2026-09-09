import { auth } from "@/lib/auth";
import { toAuthzResponse } from "@/lib/auth/authz";
import { requireUserMembership } from "@/lib/auth/organizations";
import { DRAFT_EDITOR_ROLES, assertRole } from "@/lib/auth/roles";
import {
  acceptIngestStyleTheme,
  getIngestJob,
  ingestStyleThemeProposal,
} from "@/lib/ingest/jobs";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const acceptSchema = z.object({
  documentTypeId: z.string().uuid(),
});

export async function GET(
  _request: Request,
  context: RouteContext<"/api/ingest-jobs/[id]/style-theme">,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    const membership = await requireUserMembership(session.user.id);
    assertRole(membership, DRAFT_EDITOR_ROLES);
    const loaded = await getIngestJob({
      organizationId: membership.organizationId,
      jobId: id,
    });
    return NextResponse.json(ingestStyleThemeProposal(loaded));
  } catch (error) {
    const response = toAuthzResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/ingest-jobs/[id]/style-theme">,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    const membership = await requireUserMembership(session.user.id);
    assertRole(membership, DRAFT_EDITOR_ROLES);
    const body = acceptSchema.parse(await request.json());
    const accepted = await acceptIngestStyleTheme({
      organizationId: membership.organizationId,
      jobId: id,
      documentTypeId: body.documentTypeId,
    });
    return NextResponse.json(accepted);
  } catch (error) {
    const response = toAuthzResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}
