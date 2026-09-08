import { AppNav } from "@/components/app-nav";
import { auth } from "@/lib/auth";
import { requireUserMembership } from "@/lib/auth/organizations";
import {
  DRAFT_EDITOR_ROLES,
  RoleForbiddenError,
  assertRole,
} from "@/lib/auth/roles";
import {
  DocumentTypeNotFoundError,
  getDocumentType,
} from "@/lib/document-types/versions";
import { StudioControlPanel } from "@/components/studio-control-panel";
import { emptyDraftSnapshot } from "@/lib/document-types/defaults";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StudioDraftPage({
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
    assertRole(membership, DRAFT_EDITOR_ROLES);
  } catch (error) {
    if (error instanceof RoleForbiddenError) {
      return (
        <div className="flex flex-1 flex-col gap-4 p-8">
          <AppNav role={membership.role} />
          <p>Author Studio is only available to authors and org admins.</p>
        </div>
      );
    }
    throw error;
  }

  const { id } = await params;
  let type;
  try {
    type = await getDocumentType({
      organizationId: membership.organizationId,
      documentTypeId: id,
    });
  } catch (error) {
    if (error instanceof DocumentTypeNotFoundError) {
      notFound();
    }
    throw error;
  }

  const snapshot =
    type.draftSnapshot == null
      ? emptyDraftSnapshot()
      : parseDocumentTypeVersionSnapshot(type.draftSnapshot);

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <AppNav role={membership.role} />
      <Link className="text-sm underline" href="/studio">
        All types
      </Link>
      <h1 className="text-xl font-semibold">{type.name}</h1>
      <p className="text-sm text-muted-foreground">
        Draft {type.slug} · {type.status}
      </p>
      <StudioControlPanel
        documentTypeId={type.id}
        initialSnapshot={snapshot}
      />
    </div>
  );
}
