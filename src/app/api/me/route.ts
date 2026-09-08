import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { memberships, organizations } from "@/lib/db/schema";
import { ensureOrganizationForUser } from "@/lib/auth/organizations";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  await ensureOrganizationForUser({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  const db = getDb();
  const rows = await db
    .select({
      organizationId: organizations.id,
      organizationName: organizations.name,
      externalId: organizations.externalId,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(eq(memberships.userId, session.user.id));

  return NextResponse.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
    memberships: rows,
  });
}
