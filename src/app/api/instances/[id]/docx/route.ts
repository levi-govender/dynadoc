import { auth } from "@/lib/auth";
import { toAuthzResponse } from "@/lib/auth/authz";
import { requireUserMembership } from "@/lib/auth/organizations";
import { INSTANCE_GENERATOR_ROLES, assertRole } from "@/lib/auth/roles";
import { getInstance } from "@/lib/document-types/instances";
import { snapshotFromVersionColumns } from "@/lib/document-types/versions";
import { documentTypeVersions } from "@/lib/db/schema";
import { withOrganization } from "@/lib/db/tenant";
import { eq } from "drizzle-orm";
import { issuedDocxFilename, renderDocumentDocx } from "@/lib/docx/render";
import { resolveDocument } from "@/lib/resolver/resolve";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/instances/[id]/docx">,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const membership = await requireUserMembership(session.user.id);
    assertRole(membership, INSTANCE_GENERATOR_ROLES);
    const { instance, typeSlug } = await getInstance({
      organizationId: membership.organizationId,
      instanceId: id,
    });
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
    const bytes = await renderDocumentDocx({ document: resolved.document });
    const filename = issuedDocxFilename(typeSlug, instance.createdAt);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": `attachment; filename="${filename}"`,
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
