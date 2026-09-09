import { auth } from "@/lib/auth";
import { toAuthzResponse } from "@/lib/auth/authz";
import { requireUserMembership } from "@/lib/auth/organizations";
import { DRAFT_EDITOR_ROLES, assertRole } from "@/lib/auth/roles";
import { parseIngestCategory } from "@/lib/ingest/extract";
import { rereviewIngestFile, serializeIngestJob } from "@/lib/ingest/jobs";
import { INGEST_REREVIEW_ACTIONS } from "@/lib/ingest/rereview";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  fileId: z.string().min(1),
  action: z.enum(INGEST_REREVIEW_ACTIONS),
  category: z.enum(["contract", "policy", "other"]).optional(),
  documentType: z.string().min(1).max(80).optional(),
  notificationId: z.string().min(1).optional(),
});

export async function POST(
  request: Request,
  context: RouteContext<"/api/ingest-jobs/[id]/rereview">,
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
    const loaded = await rereviewIngestFile({
      organizationId: membership.organizationId,
      jobId: id,
      fileId: body.fileId,
      action: body.action,
      userId: session.user.id,
      category: body.category ? parseIngestCategory(body.category) : undefined,
      documentType: body.documentType,
      notificationId: body.notificationId,
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
