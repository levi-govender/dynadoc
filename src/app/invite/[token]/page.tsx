import { AcceptInvitePanel } from "@/components/accept-invite-panel";
import { AppNav } from "@/components/app-nav";
import { auth } from "@/lib/auth";
import { InviteNotFoundError, getInviteByToken } from "@/lib/auth/invites";
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
    <div className="flex flex-1 flex-col items-center gap-6 p-8">
      <AppNav />
      <h1 className="text-xl font-semibold">Organization invite</h1>
      <AcceptInvitePanel
        invitedEmail={invite.invite.email}
        organizationName={invite.organizationName}
        role={invite.invite.role}
        signedInEmail={session?.user.email}
        token={token}
      />
    </div>
  );
}
