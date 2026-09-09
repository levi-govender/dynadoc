import { AcceptInvitePanel } from "@/components/accept-invite-panel";
import { AppChrome } from "@/components/app-nav";
import { PageHeader } from "@/components/page-header";
import { auth } from "@/lib/auth";
import { InviteNotFoundError, getInviteByToken } from "@/lib/auth/invites";
import { formatRole } from "@/lib/auth/roles";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  let invite;
  try {
    invite = await getInviteByToken(token);
  } catch (error) {
    if (error instanceof InviteNotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <AppChrome>
      <PageHeader
        description={`Join ${invite.organizationName} as ${formatRole(invite.invite.role)}.`}
        title="You are invited"
      />
      <AcceptInvitePanel
        invitedEmail={invite.invite.email}
        organizationName={invite.organizationName}
        role={invite.invite.role}
        signedInEmail={session?.user.email}
        token={token}
      />
    </AppChrome>
  );
}
