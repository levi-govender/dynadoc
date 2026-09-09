import { createHmac, timingSafeEqual } from "node:crypto";
import { EsignError } from "@/lib/esign/errors";
import type { DropboxSignField, DropboxSignSigner } from "@/lib/esign/tabs";

const API_BASE = "https://api.hellosign.com/v3";

export type DropboxSignClient = {
  sendSignatureRequest(args: {
    title: string;
    pdf: Buffer;
    filename: string;
    signers: DropboxSignSigner[];
    formFields: DropboxSignField[];
    metadata: Record<string, string>;
  }): Promise<{ envelopeId: string; status: string }>;
  getSignatureRequest(envelopeId: string): Promise<{
    is_complete?: boolean;
    is_declined?: boolean;
  }>;
};

function apiKey(): string {
  const key = process.env.DROPBOX_SIGN_API_KEY;
  if (!key) {
    throw new EsignError("DROPBOX_SIGN_API_KEY is not set", 503);
  }
  return key;
}

function authHeader(key: string) {
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: { error_msg: text || response.statusText } };
  }
}

export function createDropboxSignClient(
  fetchImpl: typeof fetch = fetch,
): DropboxSignClient {
  return {
    async sendSignatureRequest(args) {
      const key = apiKey();
      const body = new FormData();
      body.set("title", args.title);
      body.set("subject", args.title);
      body.set("message", "Please sign this Dynadoc document.");
      body.set(
        "test_mode",
        process.env.DROPBOX_SIGN_TEST_MODE === "false" ? "0" : "1",
      );
      args.signers.forEach((signer, index) => {
        body.set(`signers[${index}][email_address]`, signer.email_address);
        body.set(`signers[${index}][name]`, signer.name);
      });
      body.set("form_fields_per_document", JSON.stringify([args.formFields]));
      for (const [metaKey, value] of Object.entries(args.metadata)) {
        body.set(`metadata[${metaKey}]`, value);
      }
      body.set(
        "file[0]",
        new Blob([new Uint8Array(args.pdf)], { type: "application/pdf" }),
        args.filename,
      );

      const response = await fetchImpl(`${API_BASE}/signature_request/send`, {
        method: "POST",
        headers: { Authorization: authHeader(key) },
        body,
      });
      const json = (await readJson(response)) as {
        signature_request?: {
          signature_request_id?: string;
          is_complete?: boolean;
        };
        error?: { error_msg?: string };
      };
      if (!response.ok || !json.signature_request?.signature_request_id) {
        throw new EsignError(
          json.error?.error_msg ?? "Dropbox Sign send failed",
          502,
        );
      }
      return {
        envelopeId: json.signature_request.signature_request_id,
        status: json.signature_request.is_complete ? "completed" : "sent",
      };
    },

    async getSignatureRequest(envelopeId) {
      const key = apiKey();
      const response = await fetchImpl(
        `${API_BASE}/signature_request/${encodeURIComponent(envelopeId)}`,
        { headers: { Authorization: authHeader(key) } },
      );
      const json = (await readJson(response)) as {
        signature_request?: { is_complete?: boolean; is_declined?: boolean };
        error?: { error_msg?: string };
      };
      if (!response.ok || !json.signature_request) {
        throw new EsignError(
          json.error?.error_msg ?? "Dropbox Sign status failed",
          502,
        );
      }
      return json.signature_request;
    },
  };
}

export function parseDropboxSignWebhookPayload(raw: unknown): {
  eventType: string;
  envelopeId: string | null;
  organizationId: string | null;
  instanceId: string | null;
  isComplete?: boolean;
  isDeclined?: boolean;
  eventTime?: string;
  eventHash?: string;
} {
  const root =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const event =
    root.event && typeof root.event === "object"
      ? (root.event as Record<string, unknown>)
      : {};
  const request =
    root.signature_request && typeof root.signature_request === "object"
      ? (root.signature_request as Record<string, unknown>)
      : {};
  const metadata =
    request.metadata && typeof request.metadata === "object"
      ? (request.metadata as Record<string, unknown>)
      : {};
  const envelopeId =
    typeof request.signature_request_id === "string"
      ? request.signature_request_id
      : null;
  return {
    eventType: typeof event.event_type === "string" ? event.event_type : "",
    envelopeId,
    organizationId:
      typeof metadata.organization_id === "string"
        ? metadata.organization_id
        : null,
    instanceId:
      typeof metadata.instance_id === "string" ? metadata.instance_id : null,
    isComplete:
      typeof request.is_complete === "boolean"
        ? request.is_complete
        : undefined,
    isDeclined:
      typeof request.is_declined === "boolean"
        ? request.is_declined
        : undefined,
    eventTime:
      typeof event.event_time === "string" ? event.event_time : undefined,
    eventHash:
      typeof event.event_hash === "string" ? event.event_hash : undefined,
  };
}

export function verifyDropboxSignEventHash(args: {
  eventTime: string;
  eventType: string;
  eventHash: string;
  apiKey: string;
}) {
  const digest = createHmac("sha256", args.apiKey)
    .update(`${args.eventTime}${args.eventType}`)
    .digest("hex");
  const a = Buffer.from(digest);
  const b = Buffer.from(args.eventHash);
  return a.length === b.length && timingSafeEqual(a, b);
}
