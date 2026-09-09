import { AppNav } from "@/components/app-nav";
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
        <div className="flex flex-1 flex-col gap-4 p-8">
          <AppNav role={membership.role} />
          <p>Fill is only available to operators, authors, and org admins.</p>
        </div>
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-2 p-6 pb-0">
        <AppNav role={membership.role} />
        <h1 className="text-xl font-semibold">{published.type.name}</h1>
        <p className="text-sm text-muted-foreground">
          Published version only. Each generate creates a new instance and a
          new PDF. Issued files are never overwritten.
        </p>
      </div>
      <OperatorFillPanel
        documentTypeId={id}
        snapshot={published.snapshot}
      />
    </div>
  );
}
