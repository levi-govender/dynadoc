import { AppChrome } from "@/components/app-nav";
import { InboxList } from "@/components/inbox-list";
import { PageHeader } from "@/components/page-header";
import { auth } from "@/lib/auth";
import { requireUserMembership } from "@/lib/auth/organizations";
import { listNotifications, serializeNotification } from "@/lib/notifications";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }
  const membership = await requireUserMembership(session.user.id);
  const rows = await listNotifications({
    organizationId: membership.organizationId,
    userId: session.user.id,
  });

  return (
    <AppChrome email={session.user.email} role={membership.role}>
      <PageHeader
        description="Files that need a decision show up here. Nothing is merged quietly."
        title="Inbox"
      />
      <InboxList initialItems={rows.map(serializeNotification)} />
    </AppChrome>
  );
}
