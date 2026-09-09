import { AppChrome } from "@/components/app-nav";
import { EmptyState, PageHeader } from "@/components/page-header";
import { auth } from "@/lib/auth";
import { requireUserMembership } from "@/lib/auth/organizations";
import {
  INSTANCE_GENERATOR_ROLES,
  RoleForbiddenError,
  assertRole,
  canEditDraft,
} from "@/lib/auth/roles";
import { listPublishedDocumentTypes } from "@/lib/document-types/create";
import { Button } from "@/components/ui/button";
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
        description="Choose a published type. Each generate creates a new issued file."
        title="Fill"
      />
      {types.length === 0 ? (
        <EmptyState
          action={
            canEditDraft(membership.role) ? (
              <Link href="/studio">
                <Button type="button">Open Studio to publish a type</Button>
              </Link>
            ) : undefined
          }
          description={
            canEditDraft(membership.role)
              ? "Publish a document type in Studio, then come back to fill it."
              : "Ask an author to publish a document type, then return here."
          }
          title="Nothing ready to fill"
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
