import { and, desc, eq, isNull } from "drizzle-orm";
import { notifications } from "@/lib/db/schema";
import { organizationEq, withOrganization } from "@/lib/db/tenant";

export const NOTIFICATION_TYPES = [
  "ingest_holdout",
  "ingest_rereview",
  "generic",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export class NotificationNotFoundError extends Error {
  constructor(message = "Notification not found") {
    super(message);
    this.name = "NotificationNotFoundError";
  }
}

export class InvalidNotificationTypeError extends Error {
  constructor(message = "Unknown notification type") {
    super(message);
    this.name = "InvalidNotificationTypeError";
  }
}

export function parseNotificationType(value: unknown): NotificationType {
  if (
    typeof value === "string" &&
    (NOTIFICATION_TYPES as readonly string[]).includes(value)
  ) {
    return value as NotificationType;
  }
  throw new InvalidNotificationTypeError();
}

export async function notify(args: {
  organizationId: string;
  userId: string;
  type: NotificationType;
  payload?: Record<string, unknown>;
}) {
  return withOrganization(args.organizationId, async (db) => {
    const [row] = await db
      .insert(notifications)
      .values({
        organizationId: args.organizationId,
        userId: args.userId,
        kind: args.type,
        payload: args.payload ?? {},
      })
      .returning();
    if (!row) {
      throw new Error("Failed to create notification");
    }
    return row;
  });
}

export async function listNotifications(args: {
  organizationId: string;
  userId: string;
}) {
  return withOrganization(args.organizationId, async (db) => {
    return db
      .select()
      .from(notifications)
      .where(
        and(
          organizationEq(notifications.organizationId, args.organizationId),
          eq(notifications.userId, args.userId),
        ),
      )
      .orderBy(desc(notifications.createdAt));
  });
}

export async function markNotificationRead(args: {
  organizationId: string;
  userId: string;
  notificationId: string;
}) {
  return withOrganization(args.organizationId, async (db) => {
    const [existing] = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.id, args.notificationId),
          organizationEq(notifications.organizationId, args.organizationId),
          eq(notifications.userId, args.userId),
        ),
      )
      .limit(1);
    if (!existing) {
      throw new NotificationNotFoundError();
    }
    if (existing.readAt) {
      return existing;
    }
    const [updated] = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, args.notificationId),
          eq(notifications.userId, args.userId),
          organizationEq(notifications.organizationId, args.organizationId),
          isNull(notifications.readAt),
        ),
      )
      .returning();
    return updated ?? existing;
  });
}

export function serializeNotification(row: {
  id: string;
  kind: string;
  payload: unknown;
  readAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    type: row.kind,
    payload: row.payload,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
