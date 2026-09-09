import { AppChrome } from "@/components/app-nav";
import { AuthPanel } from "@/components/auth-panel";
import { PageHeader } from "@/components/page-header";
import { auth } from "@/lib/auth";
import { ensureOrganizationForUser } from "@/lib/auth/organizations";
import {
  canEditDraft,
  canGenerateInstance,
  canManageOrganization,
} from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import {
  memberships,
  organizations,
  type MembershipRole,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";

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
      .innerJoin(
        organizations,
        eq(memberships.organizationId, organizations.id),
      )
      .where(eq(memberships.userId, session.user.id))
      .limit(1);
    organizationName = row?.organizationName;
    role = row?.role;
  }

  if (!session) {
    return (
      <AppChrome>
        <div className="grid flex-1 items-center gap-12 py-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col gap-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">Document factory</p>
            <h1 className="font-heading text-4xl font-medium tracking-tight">
              Issue consistent contracts from one published type
            </h1>
            <p className="max-w-lg leading-relaxed text-muted-foreground">
              Authors design templates. Operators fill answers. Each generate
              creates a frozen PDF, Word file, and optional e-sign request—never
              overwriting an issued document.
            </p>
          </div>
          <AuthPanel signedIn={false} />
        </div>
      </AppChrome>
    );
  }

  const shortcuts = [
    role && canGenerateInstance(role)
      ? {
          href: "/fill",
          title: "Fill a document",
          description: "Answer a published type and generate a new instance.",
        }
      : null,
    role && canEditDraft(role)
      ? {
          href: "/studio",
          title: "Author Studio",
          description: "Edit drafts, publish versions, and import JSON.",
        }
      : null,
    role && canGenerateInstance(role)
      ? {
          href: "/history",
          title: "History",
          description: "Download PDF or Word, or send for e-sign.",
        }
      : null,
    {
      href: "/inbox",
      title: "Inbox",
      description: "Holdout ingest files and rereview actions.",
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
      <div className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2">
        {shortcuts.map((item) => (
          <Link
            className="bg-background px-4 py-5 transition-colors hover:bg-muted/60"
            href={item.href}
            key={item.href}
          >
            <p className="text-sm font-medium">{item.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.description}
            </p>
          </Link>
        ))}
      </div>
    </AppChrome>
  );
}
