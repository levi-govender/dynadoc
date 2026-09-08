import { auth } from "@/lib/auth";
import { toAuthzResponse } from "@/lib/auth/authz";
import { acceptInvite } from "@/lib/auth/invites";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: RouteContext<"/api/org/invites/[token]/accept">,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { token } = await context.params;
    const { membership, invite } = await acceptInvite({
      token,
      userId: session.user.id,
      email: session.user.email,
    });
    return NextResponse.json({
      organizationId: invite.organizationId,
      role: membership.role,
    });
  } catch (error) {
    const response = toAuthzResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}
