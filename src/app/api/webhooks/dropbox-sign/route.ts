import { NextResponse } from "next/server";
import { setEsignStatus } from "@/lib/document-types/instances";
import {
  parseDropboxSignWebhookPayload,
  verifyDropboxSignEventHash,
} from "@/lib/esign/dropbox-sign";
import {
  mapDropboxSignEventType,
  mapDropboxSignRequest,
} from "@/lib/esign/status";

const RECEIVED = "Hello API Event Received";

async function webhookJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return request.json();
  }
  const form = await request.formData();
  const raw = form.get("json");
  if (typeof raw !== "string") {
    return null;
  }
  return JSON.parse(raw) as unknown;
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await webhookJson(request);
  } catch {
    return new NextResponse(RECEIVED, { status: 200 });
  }
  const parsed = parseDropboxSignWebhookPayload(payload);
  const apiKey = process.env.DROPBOX_SIGN_API_KEY;
  if (
    apiKey &&
    parsed.eventHash &&
    parsed.eventTime &&
    parsed.eventType &&
    !verifyDropboxSignEventHash({
      apiKey,
      eventHash: parsed.eventHash,
      eventTime: parsed.eventTime,
      eventType: parsed.eventType,
    })
  ) {
    return NextResponse.json({ error: "Invalid event hash" }, { status: 401 });
  }
  if (parsed.envelopeId && parsed.organizationId && parsed.instanceId) {
    const fromEvent = mapDropboxSignEventType(parsed.eventType);
    const status =
      fromEvent ??
      mapDropboxSignRequest({
        is_complete: parsed.isComplete,
        is_declined: parsed.isDeclined,
      });
    try {
      await setEsignStatus({
        organizationId: parsed.organizationId,
        instanceId: parsed.instanceId,
        envelopeId: parsed.envelopeId,
        status,
      });
    } catch {
      // Unknown instance or org; still ack so Dropbox Sign does not retry forever.
    }
  }
  return new NextResponse(RECEIVED, { status: 200 });
}
