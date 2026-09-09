import { auth } from "@/lib/auth";
import { toAuthzResponse } from "@/lib/auth/authz";
import { requireUserMembership } from "@/lib/auth/organizations";
import {
  DRAFT_EDITOR_ROLES,
  INSTANCE_GENERATOR_ROLES,
  assertRole,
} from "@/lib/auth/roles";
import {
  createInstanceFromPublished,
  parseInstanceGenerateBody,
  resolveDraftForGenerate,
} from "@/lib/document-types/versions";
import { issueInstancePdf } from "@/lib/pdf/issue";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: RouteContext<"/api/document-types/[id]/instances">,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const membership = await requireUserMembership(session.user.id);
    let answers: unknown = {};
    let fromDraft = false;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const parsed = parseInstanceGenerateBody(await request.json());
      answers = parsed.answers;
      fromDraft = parsed.fromDraft;
    }
    if (fromDraft) {
      assertRole(membership, DRAFT_EDITOR_ROLES);
      const { type, snapshot, resolved } = await resolveDraftForGenerate({
        organizationId: membership.organizationId,
        documentTypeId: id,
        answers,
      });
      const issued = await issueInstancePdf({
        organizationId: membership.organizationId,
        documentTypeId: id,
        documentTypeSlug: type.slug,
        snapshot,
        resolved,
        draftWatermark: true,
      });
      return NextResponse.json({
        draft: true,
        filename: issued.filename,
        pdfBase64: issued.bytes.toString("base64"),
      });
    }
    assertRole(membership, INSTANCE_GENERATOR_ROLES);
    const { instance, snapshot, version, type, resolved } =
      await createInstanceFromPublished({
        organizationId: membership.organizationId,
        documentTypeId: id,
        createdBy: session.user.id,
        answers,
      });
    const issued = await issueInstancePdf({
      organizationId: membership.organizationId,
      documentTypeId: id,
      documentTypeSlug: type.slug,
      instanceId: instance.id,
      snapshot,
      resolved,
    });
    return NextResponse.json(
      {
        id: instance.id,
        documentTypeId: id,
        documentTypeVersionId: version.id,
        organizationId: membership.organizationId,
        snapshot,
        answers: resolved.answers,
        resolved: resolved.document,
        warnings: resolved.warnings,
        filename: issued.filename,
        issuedPdfKey: issued.objectKey,
        pdfDownload: `/api/instances/${instance.id}/pdf`,
      },
      { status: 201 },
    );
  } catch (error) {
    const response = toAuthzResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}
