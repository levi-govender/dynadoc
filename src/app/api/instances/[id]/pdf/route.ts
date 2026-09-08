import { auth } from "@/lib/auth";
import { toAuthzResponse } from "@/lib/auth/authz";
import { requireUserMembership } from "@/lib/auth/organizations";
import { INSTANCE_GENERATOR_ROLES, assertRole } from "@/lib/auth/roles";
import { getInstance } from "@/lib/document-types/instances";
import { snapshotFromVersionColumns } from "@/lib/document-types/versions";
import { documentTypeVersions } from "@/lib/db/schema";
import { withOrganization } from "@/lib/db/tenant";
import { eq } from "drizzle-orm";
import { issueInstancePdf } from "@/lib/pdf/issue";
import { resolveDocument } from "@/lib/resolver/resolve";
import { getSignedDownloadUrl } from "@/lib/storage";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/instances/[id]/pdf">,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const membership = await requireUserMembership(session.user.id);
    assertRole(membership, INSTANCE_GENERATOR_ROLES);
    const { instance, typeSlug, typeId } = await getInstance({
      organizationId: membership.organizationId,
      instanceId: id,
    });
    if (instance.issuedPdfKey) {
      const url = await getSignedDownloadUrl(instance.issuedPdfKey);
      return NextResponse.redirect(url);
    }
    const version = await withOrganization(membership.organizationId, async (db) => {
      const [row] = await db
        .select()
        .from(documentTypeVersions)
        .where(eq(documentTypeVersions.id, instance.documentTypeVersionId));
      return row ?? null;
    });
    if (!version) {
      return NextResponse.json({ error: "Version missing" }, { status: 404 });
    }
    const snapshot = snapshotFromVersionColumns(version);
    const resolved = resolveDocument(snapshot, instance.answers);
    const issued = await issueInstancePdf({
      organizationId: membership.organizationId,
      documentTypeId: typeId,
      documentTypeSlug: typeSlug,
      instanceId: instance.id,
      snapshot,
      resolved,
    });
    return new NextResponse(new Uint8Array(issued.bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${issued.filename}"`,
      },
    });
  } catch (error) {
    const response = toAuthzResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}
