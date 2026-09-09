import { auth } from "@/lib/auth";
import { toAuthzResponse } from "@/lib/auth/authz";
import { requireUserMembership } from "@/lib/auth/organizations";
import {
  markNotificationRead,
  serializeNotification,
} from "@/lib/notifications";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function PATCH(
  _request: Request,
  context: RouteContext<"/api/notifications/[id]">,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const membership = await requireUserMembership(session.user.id);
    const row = await markNotificationRead({
      organizationId: membership.organizationId,
      userId: session.user.id,
      notificationId: id,
    });
    return NextResponse.json({ notification: serializeNotification(row) });
  } catch (error) {
    const response = toAuthzResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}
