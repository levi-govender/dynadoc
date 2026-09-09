import { auth } from "@/lib/auth";
import { toAuthzResponse } from "@/lib/auth/authz";
import { requireUserMembership } from "@/lib/auth/organizations";
import { INSTANCE_GENERATOR_ROLES, assertRole } from "@/lib/auth/roles";
import {
  listInstances,
  parseInstanceListQuery,
} from "@/lib/document-types/instances";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const membership = await requireUserMembership(session.user.id);
    assertRole(membership, INSTANCE_GENERATOR_ROLES);
    const url = new URL(request.url);
    const query = parseInstanceListQuery(
      Object.fromEntries(url.searchParams.entries()),
    );
    const rows = await listInstances({
      organizationId: membership.organizationId,
      ...query,
    });
    return NextResponse.json({ instances: rows });
  } catch (error) {
    const response = toAuthzResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}
