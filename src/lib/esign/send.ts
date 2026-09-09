import { z } from "zod";
import {
  attachEsignEnvelope,
  getInstance,
  setEsignStatus,
} from "@/lib/document-types/instances";
import { resolveThemeSignatures } from "@/lib/document-types/signatures";
import { snapshotFromVersionColumns } from "@/lib/document-types/versions";
import { documentTypeVersions } from "@/lib/db/schema";
import { withOrganization } from "@/lib/db/tenant";
import { eq } from "drizzle-orm";
import type { Answers } from "@/lib/expr/evaluate";
import { styleThemeSchema } from "@/types/document-type";
import {
  createDropboxSignClient,
  type DropboxSignClient,
} from "@/lib/esign/dropbox-sign";
import { EsignError } from "@/lib/esign/errors";
import { getInstancePdfBytes } from "@/lib/esign/pdf";
import {
  ESIGN_PROVIDER_DROPBOX_SIGN,
  mapDropboxSignRequest,
} from "@/lib/esign/status";
import { mapSlotsToDropboxSign } from "@/lib/esign/tabs";

export const esignSendBodySchema = z.object({
  signers: z
    .array(
      z.object({
        slotId: z.string().min(1),
        email: z.string().email(),
        name: z.string().min(1).optional(),
      }),
    )
    .min(1),
});

export function slotsForTheme(styleTheme: unknown, answers: Answers) {
  const theme = styleThemeSchema.parse(styleTheme);
  return resolveThemeSignatures(theme, answers);
}

export async function sendInstanceForEsign(args: {
  organizationId: string;
  instanceId: string;
  signers: z.infer<typeof esignSendBodySchema>["signers"];
  client?: DropboxSignClient;
}) {
  const { instance, typeSlug } = await getInstance({
    organizationId: args.organizationId,
    instanceId: args.instanceId,
  });
  if (instance.esignEnvelopeId) {
    throw new EsignError("E-sign envelope already stored", 409);
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
  const slots = resolveThemeSignatures(
    snapshot.styleTheme,
    instance.answers as Answers,
  );
  if (slots.length === 0) {
    throw new EsignError("This document type has no signature slots");
  }
  const mapped = mapSlotsToDropboxSign({ slots, signers: args.signers });
  const pdf = await getInstancePdfBytes({
    organizationId: args.organizationId,
    instanceId: args.instanceId,
  });
  const client = args.client ?? createDropboxSignClient();
  const sent = await client.sendSignatureRequest({
    title: `${typeSlug} (${instance.id.slice(0, 8)})`,
    pdf,
    filename: `${typeSlug}.pdf`,
    signers: mapped.signers,
    formFields: mapped.formFields,
    metadata: {
      organization_id: args.organizationId,
      instance_id: instance.id,
    },
  });
  const stored = await attachEsignEnvelope({
    organizationId: args.organizationId,
    instanceId: instance.id,
    envelopeId: sent.envelopeId,
    status: sent.status === "completed" ? "completed" : "sent",
    provider: ESIGN_PROVIDER_DROPBOX_SIGN,
  });
  return stored;
}

export async function refreshInstanceEsign(args: {
  organizationId: string;
  instanceId: string;
  client?: DropboxSignClient;
}) {
  const { instance } = await getInstance({
    organizationId: args.organizationId,
    instanceId: args.instanceId,
  });
  if (!instance.esignEnvelopeId) {
    throw new EsignError("No e-sign envelope on this instance");
  }
  const client = args.client ?? createDropboxSignClient();
  const remote = await client.getSignatureRequest(instance.esignEnvelopeId);
  const status = mapDropboxSignRequest(remote);
  return setEsignStatus({
    organizationId: args.organizationId,
    instanceId: instance.id,
    envelopeId: instance.esignEnvelopeId,
    status,
  });
}
