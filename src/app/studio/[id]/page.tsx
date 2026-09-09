import { AppChrome } from "@/components/app-nav";
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
import { StudioDraftEditor } from "@/components/studio-draft-editor";
import { StudioLogoUpload } from "@/components/studio-logo-upload";
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
        <AppChrome email={session.user.email} role={membership.role}>
          <p className="text-sm text-muted-foreground">
            Author Studio is only available to authors and org admins.
          </p>
        </AppChrome>
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
    <AppChrome email={session.user.email} flush role={membership.role}>
      <header className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-3">
        <Link
          className="text-sm text-muted-foreground hover:underline"
          href="/studio"
        >
          Types
        </Link>
        <h1 className="text-base font-semibold">{type.name}</h1>
        <p className="text-xs text-muted-foreground">
          {type.slug} · {type.status}
        </p>
        <a
          className="ml-auto text-sm font-medium text-primary hover:underline"
          href={`/api/document-types/${type.id}/export?source=draft`}
        >
          Export draft JSON
        </a>
        {type.publishedVersionId ? (
          <a
            className="text-sm font-medium text-primary hover:underline"
            href={`/api/document-types/${type.id}/export?source=published`}
          >
            Export published JSON
          </a>
        ) : null}
        <StudioLogoUpload documentTypeId={type.id} />
      </header>
      <StudioDraftEditor documentTypeId={type.id} initialSnapshot={snapshot} />
    </AppChrome>
  );
}
