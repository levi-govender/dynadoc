import { AppNav } from "@/components/app-nav";
import { OperatorGenerateForm } from "@/components/operator-generate-form";
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
    <div className="flex flex-1 flex-col gap-6 p-8">
      <AppNav role={membership.role} />
      <h1 className="text-xl font-semibold">{published.type.name}</h1>
      <p className="text-sm text-muted-foreground">
        Generate stores an instance and downloads the issued PDF.
      </p>
      <OperatorGenerateForm documentTypeId={id} />
    </div>
  );
}
