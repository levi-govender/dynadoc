import { AppNav } from "@/components/app-nav";
import { InviteMemberForm } from "@/components/invite-member-form";
import { auth } from "@/lib/auth";
import { requireUserMembership } from "@/lib/auth/organizations";
import {
  ORG_ADMIN_ROLES,
  RoleForbiddenError,
  assertRole,
} from "@/lib/auth/roles";
import {
  listOrganizationInvites,
  listOrganizationMembers,
} from "@/lib/auth/invites";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OrgMembersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }
  const membership = await requireUserMembership(session.user.id);
  try {
    assertRole(membership, ORG_ADMIN_ROLES);
  } catch (error) {
    if (error instanceof RoleForbiddenError) {
      return (
        <div className="flex flex-1 flex-col gap-4 p-8">
          <AppNav role={membership.role} />
          <p>Only org admins can invite people.</p>
        </div>
      );
    }
    throw error;
  }

  const [members, invites] = await Promise.all([
    listOrganizationMembers(membership.organizationId),
    listOrganizationInvites(membership.organizationId),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <AppNav role={membership.role} />
      <h1 className="text-xl font-semibold">Organization</h1>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Invite by email</h2>
        <InviteMemberForm />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Members</h2>
        <ul className="flex max-w-lg flex-col gap-1 text-sm">
          {members.map((member) => (
            <li key={member.membershipId}>
              {member.email} ({member.role})
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Pending invites</h2>
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">None</p>
        ) : (
          <ul className="flex max-w-lg flex-col gap-1 text-sm">
            {invites.map((invite) => (
              <li key={invite.id}>
                {invite.email} ({invite.role})
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
