import { AppChrome } from "@/components/app-nav";
import { AuthPanel } from "@/components/auth-panel";
import { HomeFirstRun } from "@/components/home-first-run";
import { HomeShortcuts } from "@/components/home-shortcuts";
import { PageHeader } from "@/components/page-header";
import { auth } from "@/lib/auth";
import {
  ensureOrganizationForUser,
  requireUserMembership,
} from "@/lib/auth/organizations";
import {
  canEditDraft,
  canGenerateInstance,
  canManageOrganization,
} from "@/lib/auth/roles";
import { listDocumentTypes } from "@/lib/document-types/create";
import { listInstances } from "@/lib/document-types/instances";
import { issuedStatusLabel } from "@/lib/esign/issued-status";
import { listNotifications } from "@/lib/notifications";
import { getDb } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return (
      <AppChrome>
        <div className="grid flex-1 items-center gap-12 py-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col gap-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
              Document factory
            </p>
            <h1 className="font-heading text-4xl font-medium tracking-tight">
              Issue consistent contracts from one published type
            </h1>
            <p className="max-w-lg leading-relaxed text-muted-foreground">
              Authors design templates. Operators fill answers. Each generate
              creates a frozen PDF, Word file, and optional signature
              request—never overwriting an issued document.
            </p>
          </div>
          <AuthPanel signedIn={false} />
        </div>
      </AppChrome>
    );
  }

  await ensureOrganizationForUser({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  const membership = await requireUserMembership(session.user.id);
  const role = membership.role;
  const organizationId = membership.organizationId;
  const [org] = await getDb()
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  const organizationName = org?.name;

  const [types, inbox, issued] = await Promise.all([
    canEditDraft(role)
      ? listDocumentTypes(organizationId)
      : Promise.resolve([]),
    listNotifications({
      organizationId,
      userId: session.user.id,
    }),
    canGenerateInstance(role)
      ? listInstances({ organizationId })
      : Promise.resolve([]),
  ]);

  const unpublished = types.filter((type) => type.status !== "published");
  const unreadInbox = inbox.filter((row) => row.readAt == null).length;
  const latest = issued[0] ?? null;
  const showAuthorStart = canEditDraft(role) && types.length === 0;

  const todos: { href: string; title: string; detail: string }[] = [];
  if (canEditDraft(role) && unpublished.length > 0) {
    todos.push({
      href: `/studio/${unpublished[0]!.id}`,
      title:
        unpublished.length === 1
          ? `${unpublished[0]!.name} is not published`
          : `${unpublished.length} types are not published`,
      detail: "Publish so operators can fill them.",
    });
  }
  if (unreadInbox > 0) {
    todos.push({
      href: "/inbox",
      title:
        unreadInbox === 1
          ? "1 inbox item needs a look"
          : `${unreadInbox} inbox items need a look`,
      detail: "Decide on files set aside during ingest.",
    });
  }
  if (latest) {
    todos.push({
      href: "/history",
      title: `Last issued: ${latest.typeName}`,
      detail: `${issuedStatusLabel({
        envelopeId: latest.esignEnvelopeId,
        status: latest.esignStatus,
      })} · download or send for signature.`,
    });
  }

  const shortcuts = [
    role && canGenerateInstance(role)
      ? {
          href: "/fill",
          title: "Fill a document",
          description: "Answer a published type and issue a new file.",
        }
      : null,
    role && canEditDraft(role)
      ? {
          href: "/studio",
          title: "Studio",
          description: "Edit types and publish them for operators.",
        }
      : null,
    role && canGenerateInstance(role)
      ? {
          href: "/history",
          title: "Issued documents",
          description: "Download PDF or Word, or send for signature.",
        }
      : null,
    {
      href: "/inbox",
      title: "Inbox",
      description: "Files that need a look after ingest.",
    },
    role && canManageOrganization(role)
      ? {
          href: "/org",
          title: "Organization",
          description: "Invite authors and operators.",
        }
      : null,
  ].filter(Boolean) as { href: string; title: string; description: string }[];

  return (
    <AppChrome
      email={session.user.email}
      organizationName={organizationName}
      role={role}
    >
      <PageHeader
        description={`Welcome back${organizationName ? ` to ${organizationName}` : ""}.`}
        title="Home"
      />
      {todos.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">To do</h2>
          <ul className="grid gap-2">
            {todos.map((item) => (
              <li key={item.href + item.title}>
                <Link
                  className="block rounded-md border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
                  href={item.href}
                >
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.detail}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <HomeFirstRun showAuthorStart={showAuthorStart} />
      <HomeShortcuts items={shortcuts} />
    </AppChrome>
  );
}
