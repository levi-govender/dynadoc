import { AppChrome } from "@/components/app-nav";
import { CreateDocumentTypeForm } from "@/components/create-document-type-form";
import { ImportDocumentTypeForm } from "@/components/import-document-type-form";
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
  DRAFT_EDITOR_ROLES,
  RoleForbiddenError,
  assertRole,
} from "@/lib/auth/roles";
import { listDocumentTypes } from "@/lib/document-types/create";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }

  const membership = await requireUserMembership(session.user.id);
  try {
    assertRole(membership, DRAFT_EDITOR_ROLES);
  } catch (error) {
    if (error instanceof RoleForbiddenError) {
      return (
        <AppChrome email={session.user.email} role={membership.role}>
          <p className="text-sm text-muted-foreground">
            Author Studio is only available to authors and org admins.
          </p>
        </AppChrome>
      );
    }
    throw error;
  }

  const types = await listDocumentTypes(membership.organizationId);

  return (
    <AppChrome email={session.user.email} role={membership.role}>
      <PageHeader
        description="Create a type, open the example, or import JSON. Publish when operators should fill it."
        title="Author Studio"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New document type</CardTitle>
            <CardDescription>
              Opens a draft in Studio. Publish when operators should fill it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateDocumentTypeForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Import JSON</CardTitle>
            <CardDescription>
              Imports as a new draft. Never overwrites a published version.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImportDocumentTypeForm />
          </CardContent>
        </Card>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Types in this organization</h2>
        {types.length === 0 ? (
          <EmptyState
            description="Use New document type above, or open the example engagement."
            title="No document types yet"
          />
        ) : (
          <ul className="grid gap-2">
            {types.map((type) => (
              <li key={type.id}>
                <Link
                  className="flex items-center justify-between rounded-md border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
                  href={`/studio/${type.id}`}
                >
                  <span>
                    <span className="font-medium">{type.name}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {type.slug}
                    </span>
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
                    {type.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppChrome>
  );
}
