import { auth } from "@/lib/auth";
import { toAuthzResponse } from "@/lib/auth/authz";
import { requireUserMembership } from "@/lib/auth/organizations";
import {
  listNotifications,
  notify,
  parseNotificationType,
  serializeNotification,
} from "@/lib/notifications";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const membership = await requireUserMembership(session.user.id);
    const rows = await listNotifications({
      organizationId: membership.organizationId,
      userId: session.user.id,
    });
    return NextResponse.json({
      notifications: rows.map(serializeNotification),
    });
  } catch (error) {
    const response = toAuthzResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const membership = await requireUserMembership(session.user.id);
    let type = "generic";
    let payload: Record<string, unknown> = {};
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body: unknown = await request.json();
      if (body && typeof body === "object") {
        const record = body as { type?: unknown; payload?: unknown };
        if (record.type !== undefined) {
          type = parseNotificationType(record.type);
        }
        if (
          record.payload &&
          typeof record.payload === "object" &&
          !Array.isArray(record.payload)
        ) {
          payload = record.payload as Record<string, unknown>;
        }
      }
    }
    const row = await notify({
      organizationId: membership.organizationId,
      userId: session.user.id,
      type: parseNotificationType(type),
      payload,
    });
    return NextResponse.json(
      { notification: serializeNotification(row) },
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
