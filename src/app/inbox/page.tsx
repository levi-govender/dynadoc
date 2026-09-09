import { AppNav } from "@/components/app-nav";
import { InboxList } from "@/components/inbox-list";
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
    <div className="flex flex-1 flex-col gap-6 p-8">
      <AppNav role={membership.role} />
      <h1 className="text-xl font-semibold">Inbox</h1>
      <p className="text-sm text-muted-foreground">
        In-app notices for this account. Email is not sent from this stub.
      </p>
      <InboxList initialItems={rows.map(serializeNotification)} />
    </div>
  );
}
