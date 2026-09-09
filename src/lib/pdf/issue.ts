import { attachIssuedPdfKey } from "@/lib/document-types/instances";
import { PDF_MAX_BYTES, buildObjectKey, putObject } from "@/lib/storage";
import { resolvePdfLogo } from "@/lib/pdf/logo";
import { renderDocumentPdf } from "@/lib/pdf/render";
import type { ResolveResult } from "@/lib/resolver/resolve";
import type { DocumentTypeVersionSnapshot } from "@/types/document-type";

export function issuedPdfObjectKey(args: {
  organizationId: string;
  documentTypeId: string;
  instanceId: string;
}) {
  return buildObjectKey(
    args.organizationId,
    args.documentTypeId,
    "instances",
    args.instanceId,
    "issued.pdf",
  );
}

export function issuedPdfFilename(slug: string, at: Date) {
  const stamp = at.toISOString().replace(/[-:]/g, "").slice(0, 15);
  return `${slug}-${stamp}.pdf`;
}

export async function issueInstancePdf(args: {
  organizationId: string;
  documentTypeId: string;
  documentTypeSlug: string;
  instanceId?: string;
  snapshot: DocumentTypeVersionSnapshot;
  resolved: ResolveResult;
  draftWatermark?: boolean;
}) {
  const logo = await resolvePdfLogo({
    organizationId: args.organizationId,
    theme: args.snapshot.styleTheme,
  });
  const bytes = await renderDocumentPdf({
    theme: args.snapshot.styleTheme,
    document: args.resolved.document,
    logo,
    answers: args.resolved.answers,
    draftWatermark: args.draftWatermark === true,
  });
  const stampName = issuedPdfFilename(args.documentTypeSlug, new Date());
  const filename = args.draftWatermark
    ? stampName.replace(/\.pdf$/, "-DRAFT.pdf")
    : stampName;
  if (args.draftWatermark) {
    return { bytes, filename, objectKey: null };
  }
  if (!args.instanceId) {
    throw new Error("Issued PDF requires an instance id");
  }
  const instanceId = args.instanceId;
  let objectKey: string | null = null;
  try {
    const key = issuedPdfObjectKey({
      organizationId: args.organizationId,
      documentTypeId: args.documentTypeId,
      instanceId,
    });
    await putObject({
      key,
      body: bytes,
      contentType: "application/pdf",
      maxBytes: PDF_MAX_BYTES,
    });
    objectKey = key;
    await attachIssuedPdfKey({
      organizationId: args.organizationId,
      instanceId,
      objectKey: key,
    });
  } catch {
    objectKey = null;
  }
  return { bytes, filename, objectKey };
}
