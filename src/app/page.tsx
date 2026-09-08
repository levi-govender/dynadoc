import { AppNav } from "@/components/app-nav";
import { AuthPanel } from "@/components/auth-panel";
import { ShellPreview } from "@/components/shell-preview";
import { auth } from "@/lib/auth";
import { ensureOrganizationForUser } from "@/lib/auth/organizations";
import { canEditDraft } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { memberships, organizations, type MembershipRole } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  let organizationName: string | undefined;
  let role: MembershipRole | undefined;

  if (session) {
    await ensureOrganizationForUser({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });
    const db = getDb();
    const [row] = await db
      .select({
        organizationName: organizations.name,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
      .where(eq(memberships.userId, session.user.id))
      .limit(1);
    organizationName = row?.organizationName;
    role = row?.role;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <AppNav role={role} />
      <AuthPanel
        email={session?.user.email}
        organizationName={organizationName}
        role={role}
        signedIn={Boolean(session)}
      />
      <ShellPreview canOpenStudio={Boolean(role && canEditDraft(role))} />
    </div>
  );
}
