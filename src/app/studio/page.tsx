import { AppNav } from "@/components/app-nav";
import { auth } from "@/lib/auth";
import { requireUserMembership } from "@/lib/auth/organizations";
import {
  DRAFT_EDITOR_ROLES,
  RoleForbiddenError,
  assertRole,
} from "@/lib/auth/roles";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }

  const membership = await requireUserMembership(session.user.id);
  try {
    assertRole(membership, DRAFT_EDITOR_ROLES);
  } catch (error) {
    if (error instanceof RoleForbiddenError) {
      return (
        <div className="flex flex-1 flex-col gap-4 p-8">
          <AppNav role={membership.role} />
          <p>Author Studio is only available to authors and org admins.</p>
        </div>
      );
    }
    throw error;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <AppNav role={membership.role} />
      <h1 className="text-xl font-semibold">Author Studio</h1>
      <p className="text-sm text-muted-foreground">
        Draft editing will live here. Operators cannot open this page.
      </p>
    </div>
  );
}
