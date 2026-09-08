import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { toAuthzResponse } from "@/lib/auth/authz";
import { requireUserMembership } from "@/lib/auth/organizations";
import {
  DRAFT_EDITOR_ROLES,
  ORG_ADMIN_ROLES,
  assertRole,
} from "@/lib/auth/roles";
import { assets } from "@/lib/db/schema";
import { withOrganization } from "@/lib/db/tenant";
import {
  DocumentTypeNotFoundError,
  getDocumentType,
  saveDraft,
} from "@/lib/document-types/versions";
import { LOGO_MAX_BYTES, buildObjectKey, putObject } from "@/lib/storage";
import { emptyDraftSnapshot } from "@/lib/document-types/defaults";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const membership = await requireUserMembership(session.user.id);
    const form = await request.formData();
    const file = form.get("file");
    const documentTypeId = form.get("documentTypeId");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Logo file is required" }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.byteLength === 0) {
      return NextResponse.json({ error: "Logo file is empty" }, { status: 400 });
    }

    const typeId =
      typeof documentTypeId === "string" && documentTypeId.trim()
        ? documentTypeId.trim()
        : null;

    if (typeId) {
      assertRole(membership, DRAFT_EDITOR_ROLES);
      const type = await getDocumentType({
        organizationId: membership.organizationId,
        documentTypeId: typeId,
      });
      const assetId = randomUUID();
      const key = buildObjectKey(
        membership.organizationId,
        type.id,
        "logos",
        `${assetId}.bin`,
      );
      await putObject({
        key,
        body: bytes,
        contentType: file.type || "application/octet-stream",
        maxBytes: LOGO_MAX_BYTES,
      });
      await withOrganization(membership.organizationId, async (db) => {
        await db.insert(assets).values({
          id: assetId,
          organizationId: membership.organizationId,
          documentTypeId: type.id,
          kind: "type_logo",
          objectKey: key,
        });
      });
      const snapshot =
        type.draftSnapshot == null
          ? emptyDraftSnapshot()
          : parseDocumentTypeVersionSnapshot(type.draftSnapshot);
      await saveDraft({
        organizationId: membership.organizationId,
        documentTypeId: type.id,
        snapshot: {
          ...snapshot,
          styleTheme: {
            ...snapshot.styleTheme,
            letterhead: {
              ...snapshot.styleTheme.letterhead,
              logoAssetId: assetId,
            },
          },
        },
      });
      return NextResponse.json({ id: assetId, kind: "type_logo" }, { status: 201 });
    }

    assertRole(membership, ORG_ADMIN_ROLES);
    const assetId = randomUUID();
    const key = buildObjectKey(
      membership.organizationId,
      "org",
      "logos",
      `${assetId}.bin`,
    );
    await putObject({
      key,
      body: bytes,
      contentType: file.type || "application/octet-stream",
      maxBytes: LOGO_MAX_BYTES,
    });
    await withOrganization(membership.organizationId, async (db) => {
      await db.insert(assets).values({
        id: assetId,
        organizationId: membership.organizationId,
        kind: "org_logo",
        objectKey: key,
      });
    });
    return NextResponse.json({ id: assetId, kind: "org_logo" }, { status: 201 });
  } catch (error) {
    if (error instanceof DocumentTypeNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    const response = toAuthzResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}
