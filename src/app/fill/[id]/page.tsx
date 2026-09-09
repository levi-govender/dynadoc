import { AppChrome } from "@/components/app-nav";
import { OperatorFillPanel } from "@/components/operator-fill-panel";
import { auth } from "@/lib/auth";
import { requireUserMembership } from "@/lib/auth/organizations";
import {
  INSTANCE_GENERATOR_ROLES,
  RoleForbiddenError,
  assertRole,
} from "@/lib/auth/roles";
import {
  DocumentTypeNotFoundError,
  UnpublishedTypeError,
  getPublishedSnapshot,
} from "@/lib/document-types/versions";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function FillTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
  const { id } = await params;
  let published;
  try {
    published = await getPublishedSnapshot({
      organizationId: membership.organizationId,
      documentTypeId: id,
    });
  } catch (error) {
    if (
      error instanceof DocumentTypeNotFoundError ||
      error instanceof UnpublishedTypeError
    ) {
      notFound();
    }
    throw error;
  }
  return (
    <AppChrome email={session.user.email} flush role={membership.role}>
      <div className="flex flex-col gap-1 border-b bg-card px-6 py-4">
        <h1 className="text-xl font-semibold">{published.type.name}</h1>
        <p className="text-sm text-muted-foreground">
          Published type only. Generate creates a new file; earlier files stay.
        </p>
      </div>
      <OperatorFillPanel documentTypeId={id} snapshot={published.snapshot} />
    </AppChrome>
  );
}
