import { AppChrome } from "@/components/app-nav";
import { EmptyState, PageHeader } from "@/components/page-header";
import { auth } from "@/lib/auth";
import { requireUserMembership } from "@/lib/auth/organizations";
import {
  INSTANCE_GENERATOR_ROLES,
  RoleForbiddenError,
  assertRole,
} from "@/lib/auth/roles";
import { listPublishedDocumentTypes } from "@/lib/document-types/create";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function FillIndexPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }
  const membership = await requireUserMembership(session.user.id);
  try {
    assertRole(membership, INSTANCE_GENERATOR_ROLES);
  } catch (error) {
    if (error instanceof RoleForbiddenError) {
      return (
        <AppChrome email={session.user.email} role={membership.role}>
          <p className="text-sm text-muted-foreground">
            Fill is only available to operators, authors, and org admins.
          </p>
        </AppChrome>
      );
    }
    throw error;
  }
  const types = await listPublishedDocumentTypes(membership.organizationId);
  return (
    <AppChrome email={session.user.email} role={membership.role}>
      <PageHeader
        description="Only published versions appear here. Each generate creates a new instance."
        title="Fill"
      />
      {types.length === 0 ? (
        <EmptyState
          description="Ask an author to publish a document type, then return here to generate."
          title="Nothing published yet"
        />
      ) : (
        <ul className="grid gap-2">
          {types.map((type) => (
            <li key={type.id}>
              <Link
                className="flex items-center justify-between rounded-md border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
                href={`/fill/${type.id}`}
              >
                <span className="font-medium">{type.name}</span>
                <span className="text-sm text-muted-foreground">
                  {type.slug}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppChrome>
  );
}
