import { auth } from "@/lib/auth";
import { toAuthzResponse } from "@/lib/auth/authz";
import { requireUserMembership } from "@/lib/auth/organizations";
import { INSTANCE_GENERATOR_ROLES, assertRole } from "@/lib/auth/roles";
import {
  esignSendBodySchema,
  refreshInstanceEsign,
  sendInstanceForEsign,
} from "@/lib/esign/send";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: RouteContext<"/api/instances/[id]/esign">,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const membership = await requireUserMembership(session.user.id);
    assertRole(membership, INSTANCE_GENERATOR_ROLES);
    const json: unknown = await request.json();
    if (
      json &&
      typeof json === "object" &&
      "action" in json &&
      (json as { action?: string }).action === "refresh"
    ) {
      const row = await refreshInstanceEsign({
        organizationId: membership.organizationId,
        instanceId: id,
      });
      return NextResponse.json({
        envelopeId: row.esignEnvelopeId,
        status: row.esignStatus,
      });
    }
    const body = esignSendBodySchema.parse(json);
    const row = await sendInstanceForEsign({
      organizationId: membership.organizationId,
      instanceId: id,
      signers: body.signers,
    });
    return NextResponse.json({
      envelopeId: row.esignEnvelopeId,
      status: row.esignStatus,
    });
  } catch (error) {
    const response = toAuthzResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}
