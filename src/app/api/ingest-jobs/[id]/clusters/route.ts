import { auth } from "@/lib/auth";
import { toAuthzResponse } from "@/lib/auth/authz";
import { requireUserMembership } from "@/lib/auth/organizations";
import { DRAFT_EDITOR_ROLES, assertRole } from "@/lib/auth/roles";
import {
  mergeIngestJobClusters,
  serializeIngestJob,
  splitIngestJobCluster,
} from "@/lib/ingest/jobs";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("merge"),
    clusterIds: z.array(z.string().min(1)).length(2),
  }),
  z.object({
    action: z.literal("split"),
    clusterId: z.string().min(1),
  }),
]);

export async function POST(
  request: Request,
  context: RouteContext<"/api/ingest-jobs/[id]/clusters">,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    const membership = await requireUserMembership(session.user.id);
    assertRole(membership, DRAFT_EDITOR_ROLES);
    const parsed = bodySchema.parse(await request.json());
    const loaded =
      parsed.action === "merge"
        ? await mergeIngestJobClusters({
            organizationId: membership.organizationId,
            jobId: id,
            clusterIds: parsed.clusterIds,
          })
        : await splitIngestJobCluster({
            organizationId: membership.organizationId,
            jobId: id,
            clusterId: parsed.clusterId,
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
