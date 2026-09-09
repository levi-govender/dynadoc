import { AppChrome } from "@/components/app-nav";
import { InviteMemberForm } from "@/components/invite-member-form";
import { EmptyState, PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { requireUserMembership } from "@/lib/auth/organizations";
import {
  ORG_ADMIN_ROLES,
  RoleForbiddenError,
  assertRole,
  formatRole,
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
        <AppChrome email={session.user.email} role={membership.role}>
          <p className="text-sm text-muted-foreground">
            Only admins can invite people.
          </p>
        </AppChrome>
      );
    }
    throw error;
  }

  const [members, invites] = await Promise.all([
    listOrganizationMembers(membership.organizationId),
    listOrganizationInvites(membership.organizationId),
  ]);

  return (
    <AppChrome email={session.user.email} role={membership.role}>
      <PageHeader
        description="Admins invite authors and operators. Operators cannot invite."
        title="Organization"
      />
      <Card>
        <CardHeader>
          <CardTitle>Invite by email</CardTitle>
          <CardDescription>
            The invitee signs in with the same email, then joins this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteMemberForm />
        </CardContent>
      </Card>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Members</h2>
        <ul className="divide-y rounded-md border bg-card">
          {members.map((member) => (
            <li
              className="flex items-center justify-between px-4 py-3 text-sm"
              key={member.membershipId}
            >
              <span>{member.email}</span>
              <span className="text-muted-foreground">
                {formatRole(member.role)}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Pending invites</h2>
        {invites.length === 0 ? (
          <EmptyState
            description="Invites expire; send a new one if someone cannot join."
            title="No pending invites"
          />
        ) : (
          <ul className="divide-y rounded-md border bg-card">
            {invites.map((invite) => (
              <li
                className="flex items-center justify-between px-4 py-3 text-sm"
                key={invite.id}
              >
                <span>{invite.email}</span>
                <span className="text-muted-foreground">
                  {formatRole(invite.role)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppChrome>
  );
}
