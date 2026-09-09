import { getInstance } from "@/lib/document-types/instances";
import { snapshotFromVersionColumns } from "@/lib/document-types/versions";
import { documentTypeVersions } from "@/lib/db/schema";
import { withOrganization } from "@/lib/db/tenant";
import { eq } from "drizzle-orm";
import { issueInstancePdf } from "@/lib/pdf/issue";
import { resolveDocument } from "@/lib/resolver/resolve";
import { getObjectBytes } from "@/lib/storage";
import { EsignError } from "@/lib/esign/errors";

export async function getInstancePdfBytes(args: {
  organizationId: string;
  instanceId: string;
}): Promise<Buffer> {
  const { instance, typeSlug, typeId } = await getInstance(args);
  if (instance.issuedPdfKey) {
    try {
      return await getObjectBytes(instance.issuedPdfKey);
    } catch {
      // Fall through to an in-memory render. Do not put or attach a new key.
    }
  }
  const version = await withOrganization(args.organizationId, async (db) => {
    const [row] = await db
      .select()
      .from(documentTypeVersions)
      .where(eq(documentTypeVersions.id, instance.documentTypeVersionId));
    return row ?? null;
  });
  if (!version) {
    throw new EsignError("Version missing", 404);
  }
  const snapshot = snapshotFromVersionColumns(version);
  const resolved = resolveDocument(snapshot, instance.answers);
  const persist = !instance.issuedPdfKey;
  const issued = await issueInstancePdf({
    organizationId: args.organizationId,
    documentTypeId: typeId,
    documentTypeSlug: typeSlug,
    instanceId: instance.id,
    snapshot,
    resolved,
    persist,
  });
  return issued.bytes;
}
